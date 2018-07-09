import path from 'path'
import fs from 'fs-extra'
import request from 'request-promise-native'
import json2csv from 'json2csv'



export async function getIndexNodes ({
  base_url,
  cluster,
  port,
  timeout,
}) {
  const url = `${base_url}${cluster}:${port}/pools/default`
  // get all of the nodes in the cluster
  const { nodes } = await request(url, {
    json: true,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout,
  })
  // loop over each of the nodes, returning only host name for the nodes that have
  // the index service running
  return nodes.reduce((previous, current) => {
    if (current.services.includes('index')) {
      previous.push(current.hostname.replace(/:[0-9]+$/, ''))
    }
    return previous
  }, [])
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
  const results = []
  // loop over each node and get the stats
  for (const index_node of index_nodes_list) {
    // call the stats api for each node
    results.push(
      request(`http://${index_node.replace(/.+/, 'localhost')}:9102/stats`, {
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
  const results = []
  // loop over each node and get the stats
  for (const index_node of index_nodes_list) {
    // call the stats api for each node
    results.push(
      request(`http://${index_node.replace(/.+/, 'localhost')}:9102/getIndexStatement`, {
        json: true,
        auth: {
          username,
          password,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        timeout,
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

export default async function cbIndexExport ({
  cluster,
  secure,
  port,
  username,
  password,
  output,
  overwrite,
  timeout,
  delimiter,
}) {
  const base_url = `${secure ? 'https' : 'http'}://${username}:${password}@`
  const index_nodes_list = await getIndexNodes({
    base_url,
    cluster,
    port,
    timeout,
  })
  const index_stats = await getIndexStats({
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
  // build the output from the index_stats and definitions
  const results = []
  // loop over each bucket
  for (const bucket of Object.keys(index_stats)) {
    // loop over each index
    for (const index_name of Object.keys(index_stats[bucket])) {
      // loop over each node
      for (const index_node of Object.keys(index_stats[bucket][index_name].nodes)) {
        results.push(Object.assign(
          { bucket },
          { index_name },
          { definition: definitions[bucket][index_name] || 'N/A' },
          { index_node },
          index_stats[bucket][index_name].nodes[index_node],
        ))
      }
    }
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
