import path from 'path'
import fs from 'fs-extra'
import request from 'request-promise-native'
import json2csv from 'json2csv'
import debugLogger from 'debug'

// create a debugger for each method
const debuggers = {}

// simple debug logging function per method
export function debug (method, message, ...args) {
  if (!debuggers[method]) {
    debuggers[method] = debugLogger(method)
  }
  debuggers[method](message, ...args)
}

export async function getIndexNodes ({
  cluster,
  username,
  password,
  timeout,
}) {
  debug('getIndexNodes', 'Arguments:')
  debug('getIndexNodes', `  cluster: ${cluster}`)
  debug('getIndexNodes', `  username: ${username}`)
  debug('getIndexNodes', `  password: ${'●'.repeat(password.length)}`)
  debug('getIndexNodes', `  timeout: ${timeout}`)
  debug('getIndexNodes', 'Body:')
  // add the protocol if it isn't there already
  cluster = !cluster.match(/^https?:\/\/$/) ? `http://${cluster.replace(/^[A-Za-z]+:\/\//, '')}` : cluster
  // add the port if it isn't there
  cluster = !cluster.match(/:[0-9]+$/) ? `${cluster}:8091` : cluster
  debug('getIndexNodes', `  cluster: ${cluster}`)
  const url = `${cluster}/pools/default`
  debug('getIndexNodes', `  url: ${url}`)
  // get all of the nodes in the cluster
  const { nodes } = await request(url, {
    json: true,
    auth: {
      username,
      password,
    },
    headers: {
      'Content-Type': 'application/json',
    },
    timeout,
  })
  // loop over each of the nodes, returning only host name for the nodes that have
  // the index service running
  const index_nodes = nodes.reduce((previous, current) => {
    if (current.services.includes('index')) {
      previous.push(current.hostname.replace(/:[0-9]+$/, ''))
    }
    return previous
  }, [])
  debug('getIndexNodes', '  index_nodes: %O', index_nodes)
  return index_nodes
}


export function parseIndexStats (results) {
  const stats = {}
  // loop over each of the nodes results
  for (const index_node of results) {
    // loop over each of the index nodes properties
    for (const item of Object.keys(index_node)) {
      const parts = item.split(':')
      if (parts.length === 3) { // if there are 3 parts save the result
        const [ bucket, index_name, stat_name ] = parts
        // define the bucket if it does not exist
        if (!stats[bucket]) {
          stats[bucket] = {}
        }
        // define the index if it does not exist
        if (!stats[bucket][index_name]) {
          stats[bucket][index_name] = {
            nodes: {},
          }
        }
        // define the index_node if it does not exist
        if (!stats[bucket][index_name].nodes[index_node.hostname]) {
          stats[bucket][index_name].nodes[index_node.hostname] = {}
        }
        // add the stat
        stats[bucket][index_name].nodes[index_node.hostname][stat_name] = index_node[item]
      }
    }
  }
  return stats
}

export function getIndexStats ({
  index_nodes_list,
  username,
  password,
  timeout,
}) {
  debug('getIndexStats', 'Arguments:')
  debug('getIndexStats', '  index_nodes_list: %O', index_nodes_list)
  debug('getIndexStats', `  username: ${username}`)
  debug('getIndexStats', `  password: ${'●'.repeat(password.length)}`)
  debug('getIndexStats', `  timeout: ${timeout}`)
  debug('getIndexStats', 'Body:')
  const results = []
  // loop over each node and get the stats
  for (const index_node of index_nodes_list) {
    debug('getIndexStats', `  index_node: ${index_node}`)
    // call the stats api for each node
    results.push(
      request(`http://${index_node}:9102/stats`, {
        json: true,
        auth: {
          username,
          password,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        timeout,
      })
        .then((res) => {
          res.hostname = index_node // add the hostname to the result
          return res
        }),
    )
  }
  return Promise.all(results)
    .then(parseIndexStats)
}

export function getIndexDefinitions ({
  index_nodes_list,
  username,
  password,
  timeout,
}) {
  debug('getIndexDefinitions', 'Arguments:')
  debug('getIndexDefinitions', '  index_nodes_list: %O', index_nodes_list)
  debug('getIndexDefinitions', `  username: ${username}`)
  debug('getIndexDefinitions', `  password: ${'●'.repeat(password.length)}`)
  debug('getIndexDefinitions', `  timeout: ${timeout}`)
  debug('getIndexDefinitions', 'Body:')
  const results = []
  // loop over each node and get the stats
  for (const index_node of index_nodes_list) {
    debug('getIndexDefinitions', `  index_node: ${index_node}`)
    // call the stats api for each node
    results.push(
      request(`http://${index_node}:9102/getIndexStatement`, {
        json: true,
        auth: {
          username,
          password,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        timeout,
      })
        .catch(() => {
          return [] // 4.x and older does not have this endpoint
        }),
    )
  }
  return Promise.all(results)
    .then((defs) => {
      return defs
        .reduce((previous, current) => { // combine each nodes definitions to a single result
          return previous.concat(current)
        }, [])
        .reduce((previous, current) => { // parse the results into something usable
          let [ index_name, bucket ] = current.split(' ON ')
          index_name = index_name.replace(/^[^`]+`|`.*$/g, '')
          bucket = bucket.replace(/^\s*`|`.+$/g, '')
          // create the bucket if it isn't defined
          if (!previous[bucket]) {
            previous[bucket] = {}
          }
          // assign the definition
          previous[bucket][index_name] = current
          return previous
        }, {})
    })
}

export function buildIndexOutput ({
  stats,
  definitions,
  buckets,
}) {
  debug('buildIndexOutput', 'Arguments:')
  debug('buildIndexOutput', '  stats: N/A')
  debug('buildIndexOutput', '  definitions: N/A')
  debug('buildIndexOutput', `  buckets: ${buckets}`)
  // convert the buckets to an array
  buckets = buckets ? buckets.split(',') : Object.keys(stats)
  // build the output from the index_stats and definitions
  const results = []
  // loop over each bucket
  for (const bucket of Object.keys(stats)) {
    if (buckets.includes(bucket)) {
      // loop over each index
      for (const index_name of Object.keys(stats[bucket])) {
        // loop over each node
        for (const index_node of Object.keys(stats[bucket][index_name].nodes)) {
          results.push(Object.assign(
            { bucket },
            { index_name },
            { definition: (definitions[bucket] && definitions[bucket][index_name]) || 'N/A' },
            { index_node },
            stats[bucket][index_name].nodes[index_node],
          ))
        }
      }
    }
  }
  return results
}

export default async function cbIndexExport ({
  cluster = 'localhost',
  indexNodes: index_nodes,
  username = 'Administrator',
  password = 'password',
  output = 'export.csv',
  buckets = null,
  overwrite = false,
  timeout = 10000,
  delimiter = ',',
}) {
  debug('cbIndexExport', 'Arguments:')
  debug('cbIndexExport', `  cluster: ${cluster}`)
  debug('cbIndexExport', `  index_nodes: ${index_nodes || ''}`)
  debug('cbIndexExport', `  username: ${cluster}`)
  debug('cbIndexExport', `  password: ${'●'.repeat(password.length)}`)
  debug('cbIndexExport', `  output: ${output}`)
  debug('cbIndexExport', `  buckets: ${buckets || ''}`)
  debug('cbIndexExport', `  overwrite: ${overwrite}`)
  debug('cbIndexExport', `  timeout: ${timeout}`)
  debug('cbIndexExport', `  delimiter: ${delimiter}`)
  // use the passed index node list or retrieve them
  const index_nodes_list = index_nodes ? index_nodes.split(',') : await getIndexNodes({
    cluster,
    username,
    password,
    timeout,
  })
  const stats = await getIndexStats({
    index_nodes_list,
    username,
    password,
    timeout,
  })
  const definitions = await getIndexDefinitions({
    index_nodes_list,
    username,
    password,
    timeout,
  })
  const results = buildIndexOutput({ stats, definitions, buckets })

  // output the results to the console if it is specified
  if (output === 'console') {
    console.log(JSON.stringify(results, null, 2)) // eslint-disable-line no-console
    return
  }

  // output the results to csv file
  const json2csvParser = new json2csv.Parser({
    fields: Object.keys(results[0]),
    delimiter,
  })
  const csv = json2csvParser.parse(results)
  const output_path = !path.isAbsolute(output) ? path.join(process.cwd(), output) : output
  // make sure the output directory exists
  await fs.ensureDir(path.dirname(output_path))
  // if the file exists already throw an error
  if (await fs.pathExists(output_path)) {
    if (overwrite) {
      await fs.remove(output_path)
    } else { // cannot overwrite the existing file
      throw new Error(`The output file ${output_path} already exists, use the --overwrite true argument`)
    }
  }
  // output the file
  await fs.outputFile(output_path, csv)
}
