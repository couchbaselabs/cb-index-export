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
    '-s, --secure <b>',
    'Whether or not to use http(s)',
    false,
  )
  .option(
    '-p, --port <n>',
    'The query port to use',
    8091,
    (val) => parseInt(val, 10),
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
    'The destination output file',
    `${process.cwd()}/results.csv`,
  )
  .option(
    '-x, --overwrite <b>',
    'Overwrite the destination file if it exists already',
    false,
  )
  .option(
    '-t, --timeout <n>',
    'Timeout in milliseconds for the operation',
    (val) => parseInt(val, 10),
    10000,
  )
  .option(
    '-d, --delimiter <s>',
    'The delimiter to use',
    ',',
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
