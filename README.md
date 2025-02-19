# Table tool

The A Modified Table Block for [Editor.js](https://editorjs.io). Finally improved.

![](https://capella.pics/41294cec-a2b3-4157-8399-ffefed3d8ffd.jpg)
![](https://i.postimg.cc/wMgY2jVY/Screenshot-2022-01-07-at-4-46-13-PM.png)
![](https://i.postimg.cc/V6jcXCXF/Screenshot-2022-01-07-at-4-46-23-PM.png)

## Installation

Get the package

```shell
npm i chalkboard-table
```
or

```shell
yarn add chalkboard-table
```

## Usage

Add a new Tool to the `tools` property of the Editor.js initial config.

```javascript
import Table from '@editorjs/table';

var editor = EditorJS({
  tools: {
    table: Table,
  }
});
```

Or init the Table tool with additional settings

```javascript
var editor = EditorJS({
  tools: {
    table: {
      class: Table,
      inlineToolbar: true,
      config: {
        rows: 2,
        cols: 3,
      },
    },
  },
});
```

## Config Params

| Field              | Type     | Description          |
| ------------------ | -------- | ---------------------------------------- |
| `rows`             | `number` | initial number of rows. `2`  by default |
| `cols`             | `number` | initial number of columns. `2` by default |

## Output data

This Tool returns `data` in the following format

| Field          | Type         | Description           |
| -------------- | ------------ | ----------------------------------------- |
| `withHeadings` | `boolean`    | Uses the first line as headings |
| `content`      | `string[][]` | two-dimensional array with table contents |
| `tableProperties`      | `object` | object with table style properties  |
| `cellProperties`      | `array` | two-dimensional array with table style properties corresponding to the `content` data structure |
| `textAlignment`             | `string` | Alignnment of all text in table  |

```json
{
  "type" : "table",
  "data" : {
    "withHeadings": true,
    "content" : [ [ "Kine", "Pigs", "Chicken" ], [ "1 pcs", "3 pcs", "12 pcs" ], [ "100$", "200$", "150$" ] ],
    "tableProperties": {
      "borderColor": "#fffff",
      "backgroundColor": "#fffff",
      "borderWidth": "1px"
    },
    "cellProperties": [[{
      "borderColor": "#fffff",
      "backgroundColor": "#fffff",
      "borderWidth": "1px"
    },
      {
        "borderColor": "#fffff",
        "backgroundColor": "#fffff",
        "borderWidth": "1px"
      },
      {
        "borderColor": "#fffff",
        "backgroundColor": "#fffff",
        "borderWidth": "1px"
      }],[{
      "borderColor": "#fffff",
      "backgroundColor": "#fffff",
      "borderWidth": "1px"
    },
      {
        "borderColor": "#fffff",
        "backgroundColor": "#fffff",
        "borderWidth": "1px"
      },
      {
        "borderColor": "#fffff",
        "backgroundColor": "#fffff",
        "borderWidth": "1px"
      }],[{
      "borderColor": "#fffff",
      "backgroundColor": "#fffff",
      "borderWidth": "1px"
    },
      {
        "borderColor": "#fffff",
        "backgroundColor": "#fffff",
        "borderWidth": "1px"
      },
      {
        "borderColor": "#fffff",
        "backgroundColor": "#fffff",
        "borderWidth": "1px"
      }]],
    "textAlignment": "center"
  }
}
```

# Support maintenance 🎖

If you're using this tool and editor.js in your business, please consider supporting their maintenance and evolution.

[http://opencollective.com/editorjs](http://opencollective.com/editorjs)

# About CodeX

<img alt="codex" align="right" width="120" height="120" src="https://codex.so/public/app/img/codex-logo.svg" hspace="50">

CodeX is a team of digital specialists around the world interested in building high-quality open source products on a global market. We are [open](https://codex.so/join) for young people who want to constantly improve their skills and grow professionally with experiments in leading technologies.

| 🌐 | Join  👋  | Twitter | Instagram |
| -- | -- | -- | -- |
| [codex.so](https://codex.so) | [codex.so/join](https://codex.so/join) |[@codex_team](http://twitter.com/codex_team) | [@codex_team](http://instagram.com/codex_team) |

# Version Log
2.0.1 - Initial Version with table properties

2.0.2 - Added support for rendering saved properties 

2.0.3 - Adding support for aligning table text

2.0.4 - Fixed bug preventing alignment showing in saved data

2.0.5 - Alignment bug

2.0.6 - Don't ask

2.0.7 - Trying something

2.0.8 - Cleaning

2.0.9 - Still here

2.1.0 - Completed adding cell properties