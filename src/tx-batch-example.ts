import { initialize, getKeyringFromSeed, getDecimals, formatNumberToBalance } from "avail-js-sdk"
import { ISubmittableResult } from "@polkadot/types/types/extrinsic"
import type { AccountInfo } from '@polkadot/types/interfaces'
import config from "../config"

const main = async () => {
  try {
    console.log("Connecting to Avail Turing testnet:", config.endpoint)
    const api = await initialize(config.endpoint)
    const account = getKeyringFromSeed(config.seed)
    const decimals = getDecimals(api)
    
    // Check account balance first
    const accountInfo = await api.query.system.account(account.address) as unknown as AccountInfo
    console.log(`\nPich's account balance: ${accountInfo.data.free.toHuman()}`)
    
    // Recipient addresses
    const recipient1 = "5GVuBmrwGsDHfLZ3cNDMGLffNDC1W9xWQ7L8LQwzL2LHvi8v"
    const recipient2 = "5CtoWVBdtXxLvir2wKk3efieHNqfc6bXn66Bfg7C9U2eHogW"
    
    // Format amounts: 0.1 and 0.2 AVAIL
    const amount1 = formatNumberToBalance(0.01, decimals)
    const amount2 = formatNumberToBalance(0.02, decimals)
    
    console.log("\nPreparing batch transaction:")
    console.log(`- Transfer 0.01 AVAIL to ${recipient1}`)
    console.log(`- Transfer 0.02 AVAIL to ${recipient2}`)

    // Construct transactions to batch
    const txs = [
      api.tx.balances.transferKeepAlive(recipient1, amount1),
      api.tx.balances.transferKeepAlive(recipient2, amount2)
    ]

    // Estimate fees
    const info = await api.tx.utility.batch(txs).paymentInfo(account)
    
    // Calculate total required balance
    const totalAmount = amount1.add(amount2)
    const totalRequired = totalAmount.add(info.partialFee)
    
    console.log(`\nTransaction details:`)
    console.log(`- Total transfer amount: ${api.createType('Balance', totalAmount).toHuman()}`)
    console.log(`- Estimated fee: ${info.partialFee.toHuman()}`)
    console.log(`- Total required: ${api.createType('Balance', totalRequired).toHuman()}`)

    // Check if account has enough balance
    if (accountInfo.data.free.lt(totalRequired)) {
      throw new Error(
        `Insufficient balance.\n` +
        `Required: ${api.createType('Balance', totalRequired).toHuman()}\n` +
        `Available: ${accountInfo.data.free.toHuman()}`
      )
    }

    console.log("\nSending batch transaction...")
    
    // Send the batch transaction
    const txResult = await new Promise<ISubmittableResult>((resolve) => {
      api.tx.utility
        .batch(txs)
        .signAndSend(account, { nonce: -1 }, (result: ISubmittableResult) => {
          console.log(`Status: ${result.status.type}`)
          
          if (result.status.isInBlock) {
            console.log(`Included in block: ${result.status.asInBlock}`)
          }

          if (result.status.isFinalized || result.isError) {
            resolve(result)
          }
        })
    })

    if (txResult.isError) {
      throw new Error("Transaction failed to submit")
    }

    if (txResult.dispatchError) {
      if (txResult.dispatchError.isModule) {
        const decoded = api.registry.findMetaError(txResult.dispatchError.asModule)
        const { docs, name, section } = decoded
        throw new Error(`${section}.${name}: ${docs.join(' ')}`)
      } else {
        throw new Error(txResult.dispatchError.toString())
      }
    }

    console.log(`\nSuccess! Batch transaction finalized in block: ${txResult.status.asFinalized}`)
    console.log(`Transaction hash: ${txResult.txHash.toString()}`)
    
    process.exit(0)
  } catch (err: any) {
    console.error("\nError:", err.message)
    process.exit(1)
  }
}

main() 