# template-cli

A simple cli to create project from template

![template-cli](assets/template-cli.png)

## Features

- Created according to different project template types
- Can be created using local templates or remote templates
- Support download single template folder from Github without git clone whole project
- Rich custom configuration items

## Install

```bash
npm i -g template-cli
```

## Usage

```bash
template
```

```text
Usage: template [options] [command]

Options:
  -v,--version                   output the version number
  -h, --help                     display help for command

Commands:
  init [options] [projectName]   init project from template
  list [options] [templateType]  list template types or names
  help [command]                 display help for command
```
