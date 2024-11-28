import { initialize } from "avail-js-sdk"
import type { EventRecord } from '@polkadot/types/interfaces'
import type { Vec } from '@polkadot/types'
import config from "../config"

async function checkTxStatus(blockHash: string) {
  try {
    console.log(`\nChecking block with hash: ${blockHash}`)
    const api = await initialize(config.endpoint)

    // Get the block
    const signedBlock = await api.rpc.chain.getBlock(blockHash)
    
    // Get events at this block
    const apiAt = await api.at(blockHash)
    const allRecords = await apiAt.query.system.events() as Vec<EventRecord>

    console.log('\nBlock Information:')
    console.log('Block Number:', signedBlock.block.header.number.toNumber())
    console.log('Block Hash:', blockHash)
    console.log('Extrinsics Count:', signedBlock.block.extrinsics.length)

    // Find all extrinsics in the block
    signedBlock.block.extrinsics.forEach((extrinsic, index) => {
      console.log(`\nExtrinsic #${index}:`)
      console.log('Method:', extrinsic.method.section + '.' + extrinsic.method.method)
      console.log('Hash:', extrinsic.hash.toHex())
      console.log('Args:', JSON.stringify(extrinsic.args.map(arg => arg.toHuman()), null, 2))
    })

    // Find transfer events
    const transferEvents = allRecords.filter((record: EventRecord) => {
      const { event } = record
      return event.section === 'balances' && 
             (event.method === 'Transfer' || event.method === 'Withdraw' || event.method === 'Deposit')
    })

    if (transferEvents.length > 0) {
      console.log('\nTransfer Events Found:')
      transferEvents.forEach((record: EventRecord) => {
        const { event } = record
        console.log(`\nEvent: ${event.section}.${event.method}`)
        console.log('Data:', JSON.stringify(event.data.toHuman(), null, 2))
      })
    }

    // Check for success/failure events
    const events = allRecords.filter((record: EventRecord) => {
      const { event } = record
      return (event.section === 'system' && 
             (event.method === 'ExtrinsicSuccess' || event.method === 'ExtrinsicFailed'))
    })

    if (events.length > 0) {
      console.log('\nExtrinsic Events:')
      events.forEach((record: EventRecord) => {
        const { event, phase } = record
        if (phase.isApplyExtrinsic) {
          const extrinsicIndex = phase.asApplyExtrinsic.toNumber()
          console.log(`\nExtrinsic #${extrinsicIndex}:`)
          if (event.method === 'ExtrinsicSuccess') {
            console.log('Status: SUCCESS')
            const { weight, class: dispatchClass } = event.data[0].toHuman() as any
            console.log('Weight:', weight)
            console.log('Class:', dispatchClass)
          } else {
            console.log('Status: FAILED')
            const error = event.data[0]
            console.log('Error Details:', error.toString())
          }
        }
      })
    }

    process.exit(0)
  } catch (err) {
    console.error('\nError checking block:', err)
    process.exit(1)
  }
}

// Check the specific block
const main = async () => {
  const blockHash = "0x1114103015497297d8fc616ea97fad6122322d80c175435ff7f5a1dad10c881b"
  await checkTxStatus(blockHash)
}

main() 