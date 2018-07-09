# n1ql2csv

Exports indexes, definitions, node placement and stats from a Couchbase Cluster.

## Install

Install `cb-index-export` globally

```bash
npm install cb-index-export -g
```

Requires Node, if you don't have node, you can install `nvm`  by issuing the following command.

```bash
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
```

then

```bash
nvm install 9
```

## Usage

```bash
cb-index-export --help

  Usage: cb-index-export [options]

  This will gather all of the indexes from a cluster, along with their definitions, placement and stats.

  Options:

    -V, --version        output the version number
    -c, --cluster <s>    The cluster address (default: localhost)
    -s, --secure <b>     Whether or not to use http(s) (default: false)
    -p, --port <n>       The query port to use (default: 8091)
    -u, --username <s>   Cluster Admin or RBAC username (default: Administrator)
    -p, --password <s>   Cluster Admin or RBAC password (default: password)
    -o, --output <s>     The destination output file (default: results.csv)
    -x, --overwrite <b>  Overwrite the destination file if it exists already (default: false)
    -t, --timeout <n>    Timeout in milliseconds for the operation (default: 10000)
    -d, --delimiter <s>  The delimiter to use (default: ,)
    -h, --help           output usage information
```

## Example

```bash
cb-index-export \
  --cluster localhost \
  --username Administrator \
  --password password \
  --output somedir/results.csv \
  --overwrite true
```
