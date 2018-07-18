// imports
import commander from 'commander'
import ora from 'ora'
import notifier from 'update-notifier'
import indexes from './index'
import pkg from '../package.json'

notifier({ pkg })
  .notify()

// setup cli options
commander
  .version('0.1.0')
  .description('This will gather all of the indexes from a cluster, along with their definitions, placement and stats.')
  .option(
    '-c, --cluster <s>',
    'The cluster address',
    'localhost',
  )
  .option(
    '-in, --index-nodes <s>',
    'A comma-delimited list of index node hostnames.  If not specified they will be retrieved from the cluster map',
  )
  .option(
    '-u, --username <s>',
    'Cluster Admin or RBAC username',
    'Administrator',
  )
  .option(
    '-p, --password <s>',
    'Cluster Admin or RBAC password',
    'password',
  )
  .option(
    '-o, --output <s>',
    'The string "console" or a destination to output the file',
    `${process.cwd()}/results.csv`,
  )
  .option(
    '-b, --buckets <s>',
    'A comma-delimited list of buckets to limit results for',
  )
  .option(
    '-i, --include <s>',
    'Comma-delimited list of fields/stats to include in the output, if not specified all are included',
  )
  .option(
    '-e, --exclude <s>',
    'Comma-delimited list of fields/stats to execlue from the output',
  )
  .option(
    '-x, --overwrite <b>',
    'Overwrite the destination file if it exists already',
    false,
  )
  .option(
    '-d, --delimiter <s>',
    'The delimiter to use',
    ',',
  )
  .option(
    '-t, --timeout <n>',
    'Timeout in milliseconds for the operation',
    (val) => parseInt(val, 10),
    2000,
  )
  .parse(process.argv)

export default async function () {
  // Spinner for fun
  const spinner = ora({
    color: 'red',
    stream: process.stdout,
    text: 'Running...',
  })
    .start()
  try {
    await indexes(commander)
    spinner.stop()
    process.exit(0)
  } catch (err) {
    spinner.stop()
    // eslint-disable-next-line no-console
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }
}
