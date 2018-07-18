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
  const url = `${cluster}/pools/nodes`
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
      previous.push(current.hostname)
    }
    return previous
  }, [])
  debug('getIndexNodes', '  index_nodes: %O', index_nodes)
  return index_nodes
}

export async function getIndexDefinitions ({
  cluster,
  username,
  password,
  timeout,
}) {
  debug('getIndexDefinitions', 'Arguments:')
  debug('getIndexDefinitions', `  cluster: ${cluster}`)
  debug('getIndexDefinitions', `  username: ${username}`)
  debug('getIndexDefinitions', `  password: ${'●'.repeat(password.length)}`)
  debug('getIndexDefinitions', `  timeout: ${timeout}`)
  const url = `${cluster}/indexStatus`
  debug('getIndexDefinitions', `  url: ${url}`)
  // get all of the nodes in the cluster
  const { indexes } = await request(url, {
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
  return indexes.reduce((previous, {
    storageMode: storage_mode,
    hosts: nodes,
    definition,
    bucket,
    index: index_name,
  }) => {
    // does the bucket name exist?
    if (!previous[bucket]) {
      previous[bucket] = {}
    }
    // set the index information
    previous[bucket][index_name] = {
      bucket,
      storage_mode,
      nodes,
      definition,
      index_name,
    }
    return previous
  }, {})
}

export function getIndexStats ({
  cluster,
  username,
  password,
  buckets,
  index_nodes,
  timeout,
}) {
  debug('getIndexStats', 'Arguments:')
  debug('getIndexStats', `  cluster: ${cluster}`)
  debug('getIndexStats', `  username: ${username}`)
  debug('getIndexStats', `  password: ${'●'.repeat(password.length)}`)
  debug('getIndexStats', '  buckets: %O', buckets)
  debug('getIndexStats', '  index_nodes: %O', index_nodes)
  debug('getIndexStats', `  timeout: ${timeout}`)
  debug('getIndexStats', 'Body:')
  const results = []
  // loop over each bucket
  for (const bucket of buckets) {
    debug('getIndexStats', `  bucket: ${bucket}`)
    // loop over each node and get the stats
    for (let index_node of index_nodes) {
      // remove the protocol
      index_node = index_node.replace(/^https?:\/\/$/, '')
      // add the port if it isn't there
      index_node = !index_node.match(/:[0-9]+$/) ? `${index_node}:8091` : index_node
      debug('getIndexStats', `  index_node: ${index_node}`)
      // call the stats api for each node
      results.push(
        request(`${cluster}/pools/default/buckets/@index-${bucket}/nodes/${index_node}/stats`, {
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
          .then(({ op: { samples } = {} }) => { // eslint-disable-line no-loop-func
            const node_stats = {
              bucket,
              index_node,
              indexes: {},
            }
            for (const stat of Object.keys(samples)) {
              // if there is a stat_name avg it
              const [ , index_name, stat_name ] = stat.split('/')
              if (stat_name) {
                // create the index name if it doesn't exist already
                if (!node_stats.indexes[index_name]) {
                  node_stats.indexes[index_name] = {}
                }
                // save the stat by averaging all of the samples
                node_stats.indexes[index_name][stat_name] = samples[stat].reduce(
                  (previous, current) => {
                    return previous + current
                  },
                  0,
                ) / samples[stat].length
              }
            }
            return node_stats
          }),
      )
    }
  }
  return Promise.all(results)
    .then((node_results) => {
      const stats = {}
      // loop over each of the results
      for (const node_stats of node_results) {
        // create the bucket if it doesn't exist
        if (!stats[node_stats.bucket]) {
          stats[node_stats.bucket] = {}
        }
        // loop over each of the indexes
        for (const index of Object.keys(node_stats.indexes)) {
          // create the index name if it does not exist
          if (!stats[node_stats.bucket][index]) {
            stats[node_stats.bucket][index] = {}
          }
          // add the node stats
          stats[node_stats.bucket][index][node_stats.index_node] = node_stats.indexes[index]
        }
      }
      return stats
    })
}

export function buildIndexOutput ({
  buckets,
  index_nodes,
  stats,
  indexes,
  include = '*',
  exclude = '',
}) {
  debug('buildIndexOutput', 'Arguments:')
  debug('buildIndexOutput', '  buckets: %O', buckets)
  debug('buildIndexOutput', '  index_nodes: %O', index_nodes)
  debug('buildIndexOutput', '  stats: N/A')
  debug('buildIndexOutput', '  indexes: N/A')
  debug('buildIndexOutput', `  include: ${include}`)
  debug('buildIndexOutput', `  exclude: ${exclude}`)
  include = (include || '*').split(',')
  exclude = (exclude || '').split(',')
  // build the output from the index_stats and definitions
  const results = []
  // loop over each bucket
  for (const bucket of buckets) {
    // loop over each index in the bucket
    for (const index_name of Object.keys(indexes[bucket])) {
      // loop over each index nodes node
      for (const index_node of index_nodes) {
        results.push(
          Object.entries(Object.assign(
            { bucket },
            { index_name },
            { storage_mode: indexes[bucket][index_name].storage_mode },
            { index_node },
            { definition: indexes[bucket][index_name].definition },
            stats[bucket][index_name][index_node],
          ))
            .reduce((previous, current) => { // eslint-disable-line no-loop-func
              if ((include[0] === '*' || include.includes(current[0])) && !exclude.includes(current[0])) {
                previous[current[0]] = current[1] // eslint-disable-line prefer-destructuring
              }
              return previous
            }, {}),
        )
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
  include = '*',
  exclude = null,
  overwrite = false,
  timeout = 2000,
  delimiter = ',',
}) {
  debug('cbIndexExport', 'Arguments:')
  debug('cbIndexExport', `  cluster: ${cluster}`)
  debug('cbIndexExport', `  index_nodes: ${index_nodes || ''}`)
  debug('cbIndexExport', `  username: ${cluster}`)
  debug('cbIndexExport', `  password: ${'●'.repeat(password.length)}`)
  debug('cbIndexExport', `  output: ${output}`)
  debug('cbIndexExport', `  buckets: ${buckets || ''}`)
  debug('cbIndexExport', `  include: ${include}`)
  debug('cbIndexExport', `  exclude: ${exclude}`)
  debug('cbIndexExport', `  overwrite: ${overwrite}`)
  debug('cbIndexExport', `  timeout: ${timeout}`)
  debug('cbIndexExport', `  delimiter: ${delimiter}`)
  debug('cbIndexExport', 'Body:')
  // add the protocol if it isn't there already
  cluster = !cluster.match(/^https?:\/\/$/) ? `http://${cluster.replace(/^[A-Za-z]+:\/\//, '')}` : cluster
  // add the port if it isn't there
  cluster = !cluster.match(/:[0-9]+$/) ? `${cluster}:8091` : cluster
  debug('cbIndexExport', `  cluster: ${cluster}`)
  // get the index definitions
  const indexes = await getIndexDefinitions({
    cluster,
    username,
    password,
    index_nodes,
    timeout,
  })
  // use the passed index node list or retrieve them
  index_nodes = index_nodes ? index_nodes.split(',') : await getIndexNodes({
    cluster,
    username,
    password,
    timeout,
  })
  // use the passed buckets or get them from the indexes
  buckets = buckets ? buckets.split(',') : Object.keys(indexes)
  // get the index stats
  const stats = await getIndexStats({
    cluster,
    username,
    password,
    buckets,
    index_nodes,
    timeout,
  })
  // build the output
  const results = buildIndexOutput({
    buckets,
    index_nodes,
    stats,
    indexes,
    include,
    exclude,
  })

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
