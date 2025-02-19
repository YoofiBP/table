import svgPlusButton from './img/plus.svg';
import Toolbox from './toolbox';
import newToLeftIcon from './img/new-to-left.svg';
import newToRightIcon from './img/new-to-right.svg';
import newToUpIcon from './img/new-to-up.svg';
import newToDownIcon from './img/new-to-down.svg';
import closeIcon from './img/cross.svg';
import cellProperties from './img/cell-properties.svg';
import * as $ from './utils/dom';
import throttled from './utils/throttled';
import Popover from "./utils/popover";
import TablePropertiesPopover from "./utils/table-properties-popover";

const defaultCellStyles = {
    backgroundColor: "#ffffff",
    borderColor: "#e8e8eb",
    borderWidth: '1px'
}

/**
 * Generates and manages table contents.
 */
export default class Table {
    /**
     * Creates
     *
     * @constructor
     * @param {boolean} readOnly - read-only mode flag
     * @param {object} api - Editor.js API
     * @param {TableData} data - Editor.js API
     * @param {TableConfig} config - Editor.js API
     */
    constructor(readOnly, api, data, config) {
        this.readOnly = readOnly;
        this.api = api;
        this.data = data;
        this.config = config;
        this.data.tableProperties = this.data?.tableProperties || Object.assign({}, defaultCellStyles);

        /**
         * DOM nodes
         */
        this.wrapper = null;
        this.table = null;

        /**
         * Toolbox for managing of columns
         */
        this.toolboxColumn = this.createColumnToolbox();
        this.toolboxRow = this.createRowToolbox();

        /**
         * Toolbox for managing modification of cell properties
         * @type {Popover}
         */
        this.cellPropertiesPopover = this.createCellPropertiesPopover();
        //DOM node to hold cell properties
        this.propertiesDialog = null;

        /**
         * Create table and wrapper elements
         */
        this.createTableWrapper();

        // Current hovered row index
        this.hoveredRow = 0;

        // Current hovered column index
        this.hoveredColumn = 0;

        // Index of last selected row via toolbox
        this.selectedRow = 0;

        // Index of last selected column via toolbox
        this.selectedColumn = 0;

        // Additional settings for the table
        this.tunes = {
            withHeadings: false
        };

        /**
         * Resize table to match config/data size
         */
        this.resize();

        /**
         * Fill the table with data
         */
        this.fill();

        /**
         * The cell in which the focus is currently located, if 0 and 0 then there is no focus
         * Uses to switch between cells with buttons
         */
        this.focusedCell = {
            row: 0,
            column: 0
        };

        /**
         * Global click listener allows to delegate clicks on some elements
         */
        this.documentClicked = (event) => {
            const clickedInsideTable = event.target.closest(`.${Table.CSS.table}`) !== null;
            const outsideTableClicked = event.target.closest(`.${Table.CSS.wrapper}`) === null;
            const clickedPropertiesDialog = event.target.closest(`.${TablePropertiesPopover.CSS.propertiesDialog}`) !== null;
            const clickedSettingsZone = event.target.closest(`.${this.api.styles.settingsButton}`) !== null;
            const clickedOutsideToolboxes = clickedInsideTable || outsideTableClicked;

            if (clickedOutsideToolboxes) {
                this.hideToolboxes();
            }

            const clickedOnAddRowButton = event.target.closest(`.${Table.CSS.addRow}`);
            const clickedOnAddColumnButton = event.target.closest(`.${Table.CSS.addColumn}`);

            if((!clickedPropertiesDialog && !clickedSettingsZone) && (clickedOutsideToolboxes || clickedOnAddRowButton || clickedOnAddColumnButton)){
                this.closeOpenPropertiesDialog()
            }

            /**
             * Also, check if clicked in current table, not other (because documentClicked bound to the whole document)
             */
            if (clickedOnAddRowButton && clickedOnAddRowButton.parentNode === this.wrapper) {
                this.addRow(undefined, true);
                this.hideToolboxes();
            } else if (clickedOnAddColumnButton && clickedOnAddColumnButton.parentNode === this.wrapper) {
                this.addColumn(undefined, true);
                this.hideToolboxes();
            }
        };

        if (!this.readOnly) {
            this.bindEvents();
        }
    }

    static get CSS() {
        return {
            wrapper: 'tc-wrap',
            wrapperReadOnly: 'tc-wrap--readonly',
            table: 'tc-table',
            row: 'tc-row',
            withHeadings: 'tc-table--heading',
            rowSelected: 'tc-row--selected',
            cell: 'tc-cell',
            cellSelected: 'tc-cell--selected',
            addRow: 'tc-add-row',
            addColumn: 'tc-add-column',
            colorInput: 'color-input',
        }
    }

    /**
     * Returns the rendered table wrapper
     *
     * @returns {Element}
     */
    getWrapper() {
        return this.wrapper;
    }

    /**
     * Hangs the necessary handlers to events
     */
    bindEvents() {
        // set the listener to close toolboxes when click outside
        document.addEventListener('click', this.documentClicked);

        // Update toolboxes position depending on the mouse movements
        this.table.addEventListener('mousemove', throttled(150, (event) => this.onMouseMoveInTable(event)), {passive: true});

        // Controls some of the keyboard buttons inside the table
        this.table.onkeypress = (event) => this.onKeyPressListener(event);

        // Tab is executed by default before keypress, so it must be intercepted on keydown
        this.table.addEventListener('keydown', (event) => this.onKeyDownListener(event));

        // Determine the position of the cell in focus
        this.table.addEventListener('focusin', event => this.focusInTableListener(event));

        // Manage right clicking in cells
        this.table.addEventListener('contextmenu', event => this.tableContextMenuListener(event))
    }

    /**
     * Creates custom contextmenu for when users right-click on table cells
     */

    tableContextMenuListener(event) {
        const element = event.target;
        const elementIsCell = element.classList.contains(Table.CSS.cell);
        if (!elementIsCell) {
            return;
        }
        event.preventDefault();
        if (this.cellPropertiesPopover.opened) {
            this.cellPropertiesPopover.close()
        }
        this.cellPropertiesPopover.open();
        const tableCoords = $.getCoords(this.table);
        const destinationX = event.pageX - tableCoords.x1
        const destinationY = event.pageY - tableCoords.y1
        this.cellPropertiesPopover.element.style.left = `${destinationX}px`;
        this.cellPropertiesPopover.element.style.top = `${destinationY}px`;

    }

    /**
     * Creates popover containing cell properties
     */

    createCellPropertiesPopover() {
        return new Popover({
            items: [
                {
                    label: 'Cell Properties',
                    icon: cellProperties,
                    onClick: () => {
                        this.renderCellPropertiesDialog(this.focusedCell);
                    }
                }
            ],
        })
    }

    /**
     * Closes all open cell properties and creates new cell properties and attaches it to the DOM
     * @param cellTarget
     */
    renderCellPropertiesDialog(cellTarget) {
        this.closeOpenPropertiesDialog();
        this.propertiesDialog = this.createCellPropertiesDialog(cellTarget);
        this.wrapper.insertAdjacentElement('afterend', this.propertiesDialog)
    }

    /**
     * Removes cell properties dialog from DOM
     */
    closeOpenPropertiesDialog() {
        if(this.propertiesDialog){
            this.propertiesDialog.remove();
            this.propertiesDialog = null;
        }
    }

    /**
     * Creates Dialog containing cell style properties based on cell position
     *
     * @param {{row, column}} cellTarget
     * @returns {Element}
     */
    createCellPropertiesDialog(cellTarget) {
        const cellProperties = this.data.cellProperties[cellTarget.row - 1][cellTarget.column - 1];
        //Store reference to current cellProperties to reset properties when user cancels change
        const initialCellProperties = Object.assign({}, cellProperties);
        const cellPropertiesDialog = new TablePropertiesPopover(
            {
                api: this.api,
                properties: [{
                    label: 'Background Color',
                    inputType: 'color',
                    id: 'cell-background-color',
                    value: cellProperties.backgroundColor,
                    onChange: (value) => {
                        cellProperties.backgroundColor = value;
                        this.setCellStyle(cellTarget.row, cellTarget.column)
                    },
                    style: Table.CSS.colorInput
                },
                    {
                        label: 'Border Color',
                        inputType: 'color',
                        id: 'cell-border-color',
                        value: cellProperties.borderColor,
                        onChange: (value) => {
                            cellProperties.borderColor = value;
                            this.setCellStyle(cellTarget.row, cellTarget.column)
                        },
                        style: Table.CSS.colorInput
                    },
                    {
                        label: 'Border Width',
                        inputType: 'number',
                        id: 'cell-border-width',
                        value: Number(cellProperties.borderWidth.replace("px", "")),
                        onChange: (value) => {
                            cellProperties.borderWidth = `${value}px`;
                            this.setCellStyle(cellTarget.row, cellTarget.column)
                        },
                    }
                ],
                heading: "Cell Properties",
                onCancel: () => {
                    this.data.cellProperties[cellTarget.row - 1][cellTarget.column - 1] = initialCellProperties;
                    this.setCellStyle(cellTarget.row, cellTarget.column);
                    this.closeOpenPropertiesDialog();
                },

            }
        )

        return cellPropertiesDialog.render();
    }

    /**
     * Creates new table properties dialog and attaches it to the DOM
     */
    renderTablePropertiesDialog(){
        this.closeOpenPropertiesDialog();
        this.propertiesDialog = this.createTablePropertiesDialog();
        this.wrapper.insertAdjacentElement('afterend', this.propertiesDialog)
    }

    /**
     * Creates table properties popover element
     * @returns {Element}
     */
    createTablePropertiesDialog(){
        //Store reference to both table and cell properties to "reset" when user cancels
        //Since a table is a collection of cells if table style properties change individual cell properties must change
        const initialTableProperties = Object.assign({}, this.data.tableProperties);
        const initialCellProperties = this.data.cellProperties.map(row => {
            return row.map(style => {
                return Object.assign({}, style)
            })
        });
        const tablePropertiesPopover = new TablePropertiesPopover({
            api: this.api,
            heading: "Table Properties",
            properties: [
                {
                    label: 'Background Color',
                    inputType: 'color',
                    id: 'background-color',
                    value: this.data.tableProperties.backgroundColor,
                    onChange: (value) => {
                        this.data.tableProperties.backgroundColor = value;
                        this.data.cellProperties.forEach((row) => {
                            row.forEach((column) => {
                                column.backgroundColor = this.data.tableProperties.backgroundColor;
                            })
                        })
                        this.updateTableStyle();
                    },
                    style: Table.CSS.colorInput
                },
                {
                    label: 'Border Color',
                    inputType: 'color',
                    id: 'border-color',
                    value: this.data.tableProperties.borderColor,
                    onChange: (value) => {
                        this.data.tableProperties.borderColor = value;
                        this.data.cellProperties.forEach((row) => {
                            row.forEach((column) => {
                                column.borderColor = this.data.tableProperties.borderColor;
                            })
                        })
                        this.updateTableStyle();
                    },
                    style: Table.CSS.colorInput
                },
             /*   {
                    label: 'Border Width',
                    inputType: 'number',
                    id: 'border-width',
                    value: Number(this.data.tableProperties.borderWidth.replace('px', "")),
                    onChange: (value) => {
                         this.data.tableProperties.borderWidth = `${value}px`;
                         this.data.cellProperties.forEach((row) => {
                             row.forEach((column) => {
                                 column.borderWidth = this.data.tableProperties.borderWidth;
                             })
                         })
                        this.updateTableStyle();
                    }
                }*/
            ],
            //Reset properties on cancel
            onCancel: () => {
                this.data.tableProperties = initialTableProperties;
                this.data.cellProperties = initialCellProperties;
                this.updateTableStyle();
                this.closeOpenPropertiesDialog()
            }
        });

        return tablePropertiesPopover.render();
    }

    /**
     * Modify table styles
     */
    updateTableStyle() {
        for(const property in this.data.tableProperties){
            this.table.style[property] = this.data.tableProperties[property]
        }

        for (let i = 0; i < this.data.cellProperties.length; i++) {
            for (let j = 0; j < this.data.cellProperties[i].length; j++) {
                this.setCellStyle(i + 1, j + 1);
            }
        }
    }

    /**
     * Configures and creates the toolbox for manipulating with columns
     *
     * @returns {Toolbox}
     */
    createColumnToolbox() {
        return new Toolbox({
            api: this.api,
            cssModifier: 'column',
            items: [
                {
                    label: this.api.i18n.t('Add column to left'),
                    icon: newToLeftIcon,
                    onClick: () => {
                        this.addColumn(this.selectedColumn, true);
                        this.hideToolboxes();
                    }
                },
                {
                    label: this.api.i18n.t('Add column to right'),
                    icon: newToRightIcon,
                    onClick: () => {
                        this.addColumn(this.selectedColumn + 1, true);
                        this.hideToolboxes();
                    }
                },
                {
                    label: this.api.i18n.t('Delete column'),
                    icon: closeIcon,
                    hideIf: () => {
                        return this.numberOfColumns === 1;
                    },
                    confirmationRequired: true,
                    onClick: () => {
                        this.deleteColumn(this.selectedColumn);
                        this.hideToolboxes();
                    }
                }
            ],
            onOpen: () => {
                this.selectColumn(this.hoveredColumn);
                this.hideRowToolbox();
            },
            onClose: () => {
                this.unselectColumn();
            }
        });
    }

    /**
     * Configures and creates the toolbox for manipulating with rows
     *
     * @returns {Toolbox}
     */
    createRowToolbox() {
        return new Toolbox({
            api: this.api,
            cssModifier: 'row',
            items: [
                {
                    label: this.api.i18n.t('Add row above'),
                    icon: newToUpIcon,
                    onClick: () => {
                        this.addRow(this.selectedRow, true);
                        this.hideToolboxes();
                    }
                },
                {
                    label: this.api.i18n.t('Add row below'),
                    icon: newToDownIcon,
                    onClick: () => {
                        this.addRow(this.selectedRow + 1, true);
                        this.hideToolboxes();
                    }
                },
                {
                    label: this.api.i18n.t('Delete row'),
                    icon: closeIcon,
                    hideIf: () => {
                        return this.numberOfRows === 1;
                    },
                    confirmationRequired: true,
                    onClick: () => {
                        this.deleteRow(this.selectedRow);
                        this.hideToolboxes();
                    }
                }
            ],
            onOpen: () => {
                this.selectRow(this.hoveredRow);
                this.hideColumnToolbox();
            },
            onClose: () => {
                this.unselectRow();
            }
        });
    }

    /**
     * When you press enter it moves the cursor down to the next row
     * or creates it if the click occurred on the last one
     */
    moveCursorToNextRow() {
        if (this.focusedCell.row !== this.numberOfRows) {
            this.focusedCell.row += 1;
            this.focusCell(this.focusedCell);
        } else {
            this.addRow();
            this.focusedCell.row += 1;
            this.focusCell(this.focusedCell);
            this.updateToolboxesPosition(0, 0);
        }
    }

    /**
     * Get table cell by row and col index
     *
     * @param {number} row - cell row coordinate
     * @param {number} column - cell column coordinate
     * @returns {HTMLElement}
     */
    getCell(row, column) {
        return this.table.querySelector(`.${Table.CSS.row}:nth-child(${row}) .${Table.CSS.cell}:nth-child(${column})`);
    }

    /**
     * Get table row by index
     *
     * @param {number} row - row coordinate
     * @returns {HTMLElement}
     */
    getRow(row) {
        return this.table.querySelector(`.${Table.CSS.row}:nth-child(${row})`);
    }

    /**
     * The parent of the cell which is the row
     *
     * @param {HTMLElement} cell - cell element
     * @returns {HTMLElement}
     */
    getRowByCell(cell) {
        return cell.parentElement;
    }

    /**
     * Ger row's first cell
     *
     * @param {Element} row - row to find its first cell
     * @returns {Element}
     */
    getRowFirstCell(row) {
        return row.querySelector(`.${Table.CSS.cell}:first-child`);
    }

    /**
     * Set the sell's content by row and column numbers
     *
     * @param {number} row - cell row coordinate
     * @param {number} column - cell column coordinate
     * @param {string} content - cell HTML content
     */
    setCellContent(row, column, content) {
        const cell = this.getCell(row, column);

        cell.innerHTML = content;
    }

    /**
     * Add column in table on index place
     * Add cells in each row
     *
     * @param {number} columnIndex - number in the array of columns, where new column to insert, -1 if insert at the end
     * @param {boolean} [setFocus] - pass true to focus the first cell
     */
    addColumn(columnIndex = -1, setFocus = false) {
        let numberOfColumns = this.numberOfColumns;

        /**
         * Iterate all rows and add a new cell to -+them for creating a column
         */
        for (let rowIndex = 1; rowIndex <= this.numberOfRows; rowIndex++) {
            let cell;
            const cellElem = this.createCell();

            if (columnIndex > 0 && columnIndex <= numberOfColumns) {
                cell = this.getCell(rowIndex, columnIndex);

                $.insertBefore(cellElem, cell);
            } else {
                cell = this.getRow(rowIndex).appendChild(cellElem);
            }

            /**
             * Autofocus first cell
             */
            if (rowIndex === 1) {
                const firstCell = this.getCell(rowIndex, columnIndex > 0 ? columnIndex : numberOfColumns + 1);

                if (firstCell && setFocus) {
                    $.focus(firstCell);
                }
            }
        }
        //Add new object to cell properties data structure in table data
        if(columnIndex > 0){
            this.addCellPropertiesColumn(columnIndex - 1)
        }else {
            this.addCellPropertiesColumn(this.data.cellProperties[0]?.length || 0)
        }
    };

    /**
     * Individual cell properties are stored as a two dimensional array of objects hence
     * when a new column is added a new object needs to be inserted into each "row" (array)
     * @param {number} columnIndex
     */
    addCellPropertiesColumn(columnIndex){
        const getInitialStyle = () => {
            return Object.assign({}, this.data.tableProperties || defaultCellStyles);
        }
        const isLastIndex = this.data.cellProperties.length > 0 ? columnIndex === this.data.cellProperties[0].length : true;
        const isFirstIndex = columnIndex === 0;
        this.data.cellProperties.forEach((row) => {
            if(isLastIndex){
                row.push(getInitialStyle())
            }else if(isFirstIndex){
                row.unshift(getInitialStyle())
            }else {
                row.splice(columnIndex, 0 ,getInitialStyle())
            }
        })
    }

    /**
     * Add row in table on index place
     *
     * @param {number} index - number in the array of rows, where new column to insert, -1 if insert at the end
     * @param {boolean} [setFocus] - pass true to focus the inserted row
     * @returns {HTMLElement} row
     */
    addRow(index = -1, setFocus = false) {
        let insertedRow;
        let rowElem = $.make('div', Table.CSS.row);

        if (this.tunes.withHeadings) {
            this.removeHeadingAttrFromFirstRow();
        }

        /**
         * We remember the number of columns, because it is calculated
         * by the number of cells in the first row
         * It is necessary that the first line is filled in correctly
         */
        let numberOfColumns = this.numberOfColumns;

        if (index > 0 && index <= this.numberOfRows) {
            let row = this.getRow(index);

            insertedRow = $.insertBefore(rowElem, row);
        } else {
            insertedRow = this.table.appendChild(rowElem);
        }
        this.fillRow(insertedRow, numberOfColumns);
        //Create new "row" in data structure holding cell properties
        this.addCellPropertiesRow(numberOfColumns);

        if (this.tunes.withHeadings) {
            this.addHeadingAttrToFirstRow();
        }

        const insertedRowFirstCell = this.getRowFirstCell(insertedRow);

        if (insertedRowFirstCell && setFocus) {
            $.focus(insertedRowFirstCell);
        }

        return insertedRow;
    };

    /**
     * Individual cell properties are stored as a two dimensional array of objects hence
     * when a new row is added a new array needs to be inserted into the data structure
     * @param {number} numberOfColumns
     */
    addCellPropertiesRow(numberOfColumns){
        if(numberOfColumns){
            const newRow = [];
            for (let i = 0; i < numberOfColumns; i++) {
                newRow.push(this.data.tableProperties ? Object.assign({}, this.data.tableProperties) : Object.assign({}, defaultCellStyles))
            }
            this.data.cellProperties.push(newRow);
        }

    }

    /**
     * Delete a column by index
     *
     * @param {number} index
     */
    deleteColumn(index) {
        for (let i = 1; i <= this.numberOfRows; i++) {
            const cell = this.getCell(i, index);

            if (!cell) {
                return;
            }

            cell.remove();
        }
        //Delete cell property object in table data
        this.deleteCellPropertiesColumn(index -1)
    }

    /**
     * When a column is deleted all cell property objects at that index in table data need to be removed
     * @param {number} index
     */
    deleteCellPropertiesColumn(index){
        this.data.cellProperties.forEach((row) => {
            row.splice(index, 1);
        })
    }

    /**
     * Delete a row by index
     *
     * @param {number} index
     */
    deleteRow(index) {
        this.getRow(index).remove();
        this.removeCellPropertiesRow(index-1);

        this.addHeadingAttrToFirstRow();
    }

    /**
     * When a row is deleted the array at the specified index containing cell properties needs to be removed
     * @param {number} index
     */
    removeCellPropertiesRow(index){
        this.data.cellProperties.splice(index, 1);
    }

    /**
     * Create a wrapper containing a table, toolboxes
     * and buttons for adding rows and columns
     *
     * @returns {HTMLElement} wrapper - where all buttons for a table and the table itself will be
     */
    createTableWrapper() {
        this.wrapper = $.make('div', Table.CSS.wrapper);
        this.table = $.make('div', Table.CSS.table);
        //Set table property styles from data
        for (const prop in this.data.tableProperties) {
            this.table.style[prop] = this.data.tableProperties[prop];
        }

        if (this.readOnly) {
            this.wrapper.classList.add(Table.CSS.wrapperReadOnly);
        }

        this.wrapper.appendChild(this.toolboxRow.element);
        this.wrapper.appendChild(this.toolboxColumn.element);
        this.wrapper.appendChild(this.table);

        if (!this.readOnly) {
            const addColumnButton = $.make('div', Table.CSS.addColumn, {
                innerHTML: svgPlusButton
            });
            const addRowButton = $.make('div', Table.CSS.addRow, {
                innerHTML: svgPlusButton
            });

            this.wrapper.appendChild(addColumnButton);
            this.wrapper.appendChild(addRowButton);
        }
        //Create cell options dialog element and attach it to DOM
        const cellOptionsWrapper = this.cellPropertiesPopover.render();
        cellOptionsWrapper.style.position = 'absolute';
        this.wrapper.appendChild(cellOptionsWrapper);
    }

    /**
     * Returns the size of the table based on initial data or config "size" property
     *
     * @return {{rows: number, cols: number}} - number of cols and rows
     */
    computeInitialSize() {
        const content = this.data && this.data.content;
        const isValidArray = Array.isArray(content);
        const isNotEmptyArray = isValidArray ? content.length : false;
        const contentRows = isValidArray ? content.length : undefined;
        const contentCols = isNotEmptyArray ? content[0].length : undefined;
        const parsedRows = Number.parseInt(this.config && this.config.rows);
        const parsedCols = Number.parseInt(this.config && this.config.cols);

        /**
         * Value of config have to be positive number
         */
        const configRows = !isNaN(parsedRows) && parsedRows > 0 ? parsedRows : undefined;
        const configCols = !isNaN(parsedCols) && parsedCols > 0 ? parsedCols : undefined;
        const defaultRows = 2;
        const defaultCols = 2;
        const rows = contentRows || configRows || defaultRows;
        const cols = contentCols || configCols || defaultCols;

        return {
            rows: rows,
            cols: cols
        };
    }

    /**
     * Resize table to match config size or transmitted data size
     *
     * @return {{rows: number, cols: number}} - number of cols and rows
     */
    resize() {
        const {rows, cols} = this.computeInitialSize();

        for (let i = 0; i < rows; i++) {
            this.addRow();
        }
        for (let i = 0; i < cols; i++) {
            this.addColumn();
        }
        //Load cell styles from data
        this.initCellStyles(rows, cols);
    }

    /**
     * We load any cell properties from previous data or use default cell styles
     * If the table is being created for the first time it creates a two dimensional
     * array which contains objects with cell styles
     * Inner arrays are rows and objects at the indexes are columns
     * @param {number} rows
     * @param {number} cols
     */
    initCellStyles(rows, cols) {
        const styles = [];
        for (let i = 0; i < rows; i++) {
            styles.push([]);
            for (let j = 0; j < cols; j++) {
                styles[i].push(this.data.cellProperties?.[i]?.[j] ? this.data.cellProperties?.[i]?.[j] : Object.assign({},defaultCellStyles))
            }
        }
        this.data.cellProperties = styles;
    }

    /**
     * Fills the table with data passed to the constructor
     *
     * @returns {void}
     */
    fill() {
        const data = this.data;

        if (data && data.content) {
            for (let i = 0; i < data.content.length; i++) {
                for (let j = 0; j < data.content[i].length; j++) {
                    this.setCellContent(i + 1, j + 1, data.content[i][j]);
                    //Apply cell styles from data
                    this.setCellStyle(i + 1, j + 1);
                }
            }
        }
    }

    /**
     * We set element style based on cell properties in data
     * @param {number} row
     * @param {number} col
     */
    setCellStyle(row, col) {
        const cell = this.getCell(row, col);
        const cellStyleProperties = this.data.cellProperties[row - 1][col - 1]; //we subtract because array indexes begin from zero hence the 1st rows style is the 0th element in the structure
        for (const property in cellStyleProperties) {
            cell.style[property] = cellStyleProperties[property];
        }

    }

    /**
     * Fills a row with cells
     *
     * @param {HTMLElement} row - row to fill
     * @param {number} numberOfColumns - how many cells should be in a row
     */
    fillRow(row, numberOfColumns) {
        for (let i = 1; i <= numberOfColumns; i++) {
            const newCell = this.createCell();

            row.appendChild(newCell);
        }
    }

    /**
     * Creating a cell element
     *
     * @return {Element}
     */
    createCell() {
        return $.make('div', Table.CSS.cell, {
            contentEditable: !this.readOnly
        });
    }

    /**
     * Get number of rows in the table
     */
    get numberOfRows() {
        return this.table.childElementCount;
    }

    /**
     * Get number of columns in the table
     */
    get numberOfColumns() {
        if (this.numberOfRows) {
            return this.table.querySelector(`.${Table.CSS.row}:first-child`).childElementCount;
        }

        return 0;
    }

    /**
     * Is the column toolbox menu displayed or not
     *
     * @returns {boolean}
     */
    get isColumnMenuShowing() {
        return this.selectedColumn !== 0;
    }

    /**
     * Is the row toolbox menu displayed or not
     *
     * @returns {boolean}
     */
    get isRowMenuShowing() {
        return this.selectedRow !== 0;
    }

    /**
     * Recalculate position of toolbox icons
     *
     * @param {Event} event - mouse move event
     */
    onMouseMoveInTable(event) {
        const {row, column} = this.getHoveredCell(event);
        this.hoveredColumn = column;
        this.hoveredRow = row;

        this.updateToolboxesPosition();
    }

    /**
     * Prevents default Enter behaviors
     * Adds Shift+Enter processing
     *
     * @param {KeyboardEvent} event - keypress event
     */
    onKeyPressListener(event) {
        if (event.key === 'Enter') {
            if (event.shiftKey) {
                return true;
            }

            this.moveCursorToNextRow();
        }

        return event.key !== 'Enter';
    };

    /**
     * Prevents tab keydown event from bubbling
     * so that it only works inside the table
     *
     * @param {KeyboardEvent} event - keydown event
     */
    onKeyDownListener(event) {
        if (event.key === 'Tab') {
            event.stopPropagation();
        }
    }

    /**
     * Set the coordinates of the cell that the focus has moved to
     *
     * @param {FocusEvent} event - focusin event
     */
    focusInTableListener(event) {
        const cell = event.target;
        const row = this.getRowByCell(cell);

        this.focusedCell = {
            row: Array.from(this.table.querySelectorAll(`.${Table.CSS.row}`)).indexOf(row) + 1,
            column: Array.from(row.querySelectorAll(`.${Table.CSS.cell}`)).indexOf(cell) + 1
        };
    }

    /**
     * Unselect row/column
     * Close toolbox menu
     * Hide toolboxes
     *
     * @returns {void}
     */
    hideToolboxes() {
        this.hideRowToolbox();
        this.hideColumnToolbox();
        this.updateToolboxesPosition();
        this.hideCellPropertiesPopover();
    }

    /**
     * Unselect row, close toolbox
     *
     * @returns {void}
     */
    hideRowToolbox() {
        this.unselectRow();
        this.toolboxRow.hide();
    }

    /**
     * Unselect column, close toolbox
     *
     * @returns {void}
     */
    hideColumnToolbox() {
        this.unselectColumn();

        this.toolboxColumn.hide();
    }

    /**
     * Close cell properties
     */
    hideCellPropertiesPopover() {
        this.cellPropertiesPopover.close();
    }
    /**
     * Set the cursor focus to the focused cell
     *
     * @returns {void}
     */
    focusCell() {
        this.focusedCellElem.focus();
    }

    /**
     * Get current focused element
     *
     * @returns {HTMLElement} - focused cell
     */
    get focusedCellElem() {
        const {row, column} = this.focusedCell;

        return this.getCell(row, column);
    }

    /**
     * Update toolboxes position
     *
     * @param {number} row - hovered row
     * @param {number} column - hovered column
     */
    updateToolboxesPosition(row = this.hoveredRow, column = this.hoveredColumn) {
        if (!this.isColumnMenuShowing) {
            if (column > 0 && column <= this.numberOfColumns) { // not sure this statement is needed. Maybe it should be fixed in getHoveredCell()
                this.toolboxColumn.show(() => {
                    return {
                        left: `calc((100% - var(--cell-size)) / (${this.numberOfColumns} * 2) * (1 + (${column} - 1) * 2))`
                    };
                });
            }
        }

        if (!this.isRowMenuShowing) {
            if (row > 0 && column <= this.numberOfColumns) { // not sure this statement is needed. Maybe it should be fixed in getHoveredCell()
                this.toolboxRow.show(() => {
                    const hoveredRowElement = this.getRow(row);
                    const {fromTopBorder} = $.getRelativeCoordsOfTwoElems(this.table, hoveredRowElement);
                    const {height} = hoveredRowElement.getBoundingClientRect();

                    return {
                        top: `${Math.ceil(fromTopBorder + height / 2)}px`
                    };
                });
            }
        }
    }

    /**
     * Makes the first row headings
     *
     * @param {boolean} withHeadings - use headings row or not
     */
    setHeadingsSetting(withHeadings) {
        this.tunes.withHeadings = withHeadings;

        if (withHeadings) {
            this.table.classList.add(Table.CSS.withHeadings);
            this.addHeadingAttrToFirstRow();
        } else {
            this.table.classList.remove(Table.CSS.withHeadings);
            this.removeHeadingAttrFromFirstRow();
        }
    }

    /**
     * Adds an attribute for displaying the placeholder in the cell
     */
    addHeadingAttrToFirstRow() {
        for (let cellIndex = 1; cellIndex <= this.numberOfColumns; cellIndex++) {
            let cell = this.getCell(1, cellIndex);

            if (cell) {
                cell.setAttribute('heading', this.api.i18n.t('Heading'));
            }
        }
    }

    /**
     * Removes an attribute for displaying the placeholder in the cell
     */
    removeHeadingAttrFromFirstRow() {
        for (let cellIndex = 1; cellIndex <= this.numberOfColumns; cellIndex++) {
            let cell = this.getCell(1, cellIndex);

            if (cell) {
                cell.removeAttribute('heading');
            }
        }
    }

    /**
     * Add effect of a selected row
     *
     * @param {number} index
     */
    selectRow(index) {
        const row = this.getRow(index);

        if (row) {
            this.selectedRow = index;
            row.classList.add(Table.CSS.rowSelected);
        }
    }

    /**
     * Remove effect of a selected row
     */
    unselectRow() {
        if (this.selectedRow <= 0) {
            return;
        }

        const row = this.table.querySelector(`.${Table.CSS.rowSelected}`);

        if (row) {
            row.classList.remove(Table.CSS.rowSelected);
        }

        this.selectedRow = 0;
    }

    /**
     * Add effect of a selected column
     *
     * @param {number} index
     */
    selectColumn(index) {
        for (let i = 1; i <= this.numberOfRows; i++) {
            const cell = this.getCell(i, index);

            if (cell) {
                cell.classList.add(Table.CSS.cellSelected);
            }
        }

        this.selectedColumn = index;
    }

    /**
     * Remove effect of a selected column
     */
    unselectColumn() {
        if (this.selectedColumn <= 0) {
            return;
        }

        let cells = this.table.querySelectorAll(`.${Table.CSS.cellSelected}`);

        Array.from(cells).forEach(column => {
            column.classList.remove(Table.CSS.cellSelected);
        });

        this.selectedColumn = 0;
    }

    /**
     * Calculates the row and column that the cursor is currently hovering over
     * The search was optimized from O(n) to O (log n) via bin search to reduce the number of calculations
     *
     * @param {Event} event - mousemove event
     * @returns hovered cell coordinates as an integer row and column
     */
    getHoveredCell(event) {
        let hoveredRow = this.hoveredRow;
        let hoveredColumn = this.hoveredColumn;
        const {width, height, x, y} = $.getCursorPositionRelativeToElement(this.table, event);

        // Looking for hovered column
        if (x >= 0) {
            hoveredColumn = this.binSearch(
                this.numberOfColumns,
                (mid) => this.getCell(1, mid),
                ({fromLeftBorder}) => x < fromLeftBorder,
                ({fromRightBorder}) => x > (width - fromRightBorder)
            );
        }

        // Looking for hovered row
        if (y >= 0) {
            hoveredRow = this.binSearch(
                this.numberOfRows,
                (mid) => this.getCell(mid, 1),
                ({fromTopBorder}) => y < fromTopBorder,
                ({fromBottomBorder}) => y > (height - fromBottomBorder)
            );
        }

        return {
            row: hoveredRow || this.hoveredRow,
            column: hoveredColumn || this.hoveredColumn
        };
    }

    /**
     * Looks for the index of the cell the mouse is hovering over.
     * Cells can be represented as ordered intervals with left and
     * right (upper and lower for rows) borders inside the table, if the mouse enters it, then this is our index
     *
     * @param {number} numberOfCells - upper bound of binary search
     * @param {function} getCell - function to take the currently viewed cell
     * @param {function} beforeTheLeftBorder - determines the cursor position, to the left of the cell or not
     * @param {function} afterTheRightBorder - determines the cursor position, to the right of the cell or not
     * @returns {number}
     */
    binSearch(numberOfCells, getCell, beforeTheLeftBorder, afterTheRightBorder) {
        let leftBorder = 0;
        let rightBorder = numberOfCells + 1;
        let totalIterations = 0;
        let mid;

        while (leftBorder < rightBorder - 1 && totalIterations < 10) {
            mid = Math.ceil((leftBorder + rightBorder) / 2);
            const cell = getCell(mid)
           /* if(cell === null){
                break;
            }*/
            const relativeCoords = $.getRelativeCoordsOfTwoElems(this.table, cell);

            if (beforeTheLeftBorder(relativeCoords)) {
                rightBorder = mid;
            } else if (afterTheRightBorder(relativeCoords)) {
                leftBorder = mid;
            } else {
                break;
            }

            totalIterations++;
        }

        return mid;
    }

    /**
     * Collects data from cells into a two-dimensional array
     *
     * @returns {object}
     */
    getData() {
        const data = {}
        const contentData = []; //holds actual cell data
        const cellProperties = []; //holds cell style properties

        for (let i = 1; i <= this.numberOfRows; i++) {
            const row = this.table.querySelector(`.${Table.CSS.row}:nth-child(${i})`);
            const cells = Array.from(row.querySelectorAll(`.${Table.CSS.cell}`));
            const isEmptyRow = cells.every(cell => !cell.textContent.trim());

            if (isEmptyRow) {
                continue;
            }

            contentData.push(cells.map(cell => cell.innerHTML));
            cellProperties.push(this.data.cellProperties[i-1])
        }

        data.content = contentData;
        data.cellProperties = cellProperties;
        data.tableProperties = this.data.tableProperties;

        return data;
    }

    /**
     * Remove listeners on the document
     */
    destroy() {
        document.removeEventListener('click', this.documentClicked);
    }
}
