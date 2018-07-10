# cb-index-export

Exports indexes, definitions, node placement and stats from a Couchbase Cluster.

--

### Requirements

Requires Node, if you don't have node, you can install `nvm`  by issuing the following command.

```bash
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
```

Reinitialize shell

```bash
. ~/.bashrc
```

then

```bash
nvm install 9
```


## Installing from Repo

1\. Clone the Repo

```bash
https://github.com/couchbaselabs/cb-index-export.git
```

2\. Move to the repo directory

```bash
cd cb-index-export
```

3\. Install Dependencies

```bash
make install
```

4\. Build the project

```bash
make build
```

5\. Link globally

```bash
npm link
```

## Installing from NPM

Install `cb-index-export` globally

```bash
npm install cb-index-export -g
```

## Usage

```bash
cb-index-export --help

  Usage: cb-index-export [options]

  This will gather all of the indexes from a cluster, along with their definitions, placement and stats.

  Options:

    -V, --version          output the version number
    -c, --cluster <s>      The cluster address (default: localhost)
    -i, --index-nodes <s>  A comma-delimited list of index node hostnames.  If not specified they will be retrieved from the cluster map
    -u, --username <s>     Cluster Admin or RBAC username (default: Administrator)
    -p, --password <s>     Cluster Admin or RBAC password (default: password)
    -o, --output <s>       The string "console" or a destination to output the file (default: /Users/aaronbenton/projects/couchbase/results.csv)
    -x, --overwrite <b>    Overwrite the destination file if it exists already (default: false)
    -d, --delimiter <s>    The delimiter to use (default: ,)
    -t, --timeout <n>      Timeout in milliseconds for the operation (default: 2000)
    -d, --delimiter <s>    The delimiter to use (default: ,)
    -h, --help             output usage information
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
