import { Ed25519Keypair, JsonRpcProvider, Network, RawSigner } from '@mysten/sui.js';
import bip39 from 'bip39';
import fs from 'fs';
import consoleStamp from 'console-stamp';
import axios from 'axios';
import { config } from './config.js';
import { accessories } from './accessories.js';
import randUserAgent from 'rand-user-agent';
import HttpsProxyAgent from 'https-proxy-agent';
import BigNumber from "bignumber.js";

consoleStamp(console, { format: ':date(HH:MM:ss)' });

const parseFile = fileName => fs.readFileSync(fileName, "utf8").split('\n').map(str => str.trim()).filter(str => str.length > 10);
const saveMnemonic = mnemonic => fs.appendFileSync("mnemonics.txt", `${mnemonic}\n`, "utf8");
const timeout = ms => new Promise(res => setTimeout(res, ms))
const generateRandomAmount = (min, max) => Math.random() * (max - min) + min;
const provider = new JsonRpcProvider(Network.DEVNET);
const [ip, port, login, password] = config.proxy.split(":");
const proxy = `http://${login}:${password}@${ip}:${port}`;
const axiosProxyInstance = axios.create({ httpsAgent: HttpsProxyAgent(proxy) });
const availableAccessories = accessories.filter(item => !item.name.includes('holiday'))

const nftArray = [[
    'Example NFT',
    'An NFT created by Sui Wallet',
    'ipfs://QmZPWWy5Si54R3d26toaqRiqvCH7HkGdXkxwUgCm2oKKM2?filename=img-sq-01.png',
], [
    'Wizard Land',
    'Expanding The Magic Land',
    'https://gateway.pinata.cloud/ipfs/QmYfw8RbtdjPAF3LrC6S3wGVwWgn6QKq4LGS4HFS55adU2?w=800&h=450&c=crop',
], [
    'Ethos 2048 Game',
    'This player has unlocked the 2048 tile on Ethos 2048. They are a Winner!',
    'https://arweave.net/QW9doLmmWdQ-7t8GZ85HtY8yzutoir8lGEJP9zOPQqA',
], [
    "Sui Test Ecosystem",
    "Get ready for the Suinami 🌊",
    "ipfs://QmVnWhM2qYr9JkjGLaEVSZnCprRLDW8qns1oYYVXjnb4DA/sui.jpg"
], [
    "Skull Sui",
    "Skulls are emerging from the ground!",
    "https://gateway.pinata.cloud/ipfs/QmcsJtucGrzkup9cZp2N8vvTc9zxuQtV85z3g2Rs4YRLGX"
]]

const contracts = {
    VITE_PACKAGE_ID: "0x736fe293da17a584d9e985f83737219455dba07d",
    VITE_VERSION: "1",
    VITE_DIGEST: "iAApXWGHm6yoo9KVjPCTSlyNgwklmjrmg8SHOskA/vk=",
    VITE_REGISTRY: "0x134946d3ae363f5785122f47d760f653f4130148",
    VITE_REGISTRY_V: "5",
    VITE_CAPY_MARKET: "0xb72094559ea2225003338245be04a844b39db5de",
    VITE_CAPY_MARKET_V: "5",
    VITE_ITEM_STORE: "0xab035e81b5b0d6b04a393273a9c1210ab2421ae7",
    VITE_ITEM_STORE_V: "5",
    VITE_EDEN: "0x6591ee699fd4237afad83dd7dd911678aaf12694",
    VITE_EDEN_V: "5",
    VITE_API_URL: "https://api.capy.art",
    VITE_SUI_NETWORK: "devnet",
    VITE_USER_NODE_ENV: "production",
    BASE_URL: "/",
    MODE: "production",
    DEV: !1,
    PROD: !0
}

function errorHandler() {
    process.on('uncaughtException', (err) => {
        console.log(`Uncaught Exception: ${err?.message}`)
        fs.appendFile('logs.txt', `${err}\n\n`)
        process.exit(1)
    })

    process.on('unhandledRejection', (reason, promise) => {
        console.log('Unhandled rejection at ', promise, `reason: ${reason.message}`)
        fs.appendFile('logs.txt', `${reason}\n\n`)
    })
}

async function mintNft(signer, args) {
    console.log(`Minting: ${args[1]}`);

    return await signer.executeMoveCall({
        packageObjectId: '0x2',
        module: 'devnet_nft',
        function: 'mint',
        typeArguments: [],
        arguments: args,
        gasBudget: 10000,
    })
}

async function mintCapy(signer) {
    console.log(`Minting Capy`);

    let data = await signer.executeMoveCall({
        packageObjectId: contracts.VITE_PACKAGE_ID,
        module: 'eden',
        function: 'get_capy',
        typeArguments: [],
        arguments: [contracts.VITE_EDEN, contracts.VITE_REGISTRY],
        gasBudget: 10000
    })

    if (data) return data.EffectsCert.effects.effects.events.find(i => i.moveEvent).moveEvent.fields.id;
}

const getRandomAccessory = () => availableAccessories[Math.floor(Math.random() * availableAccessories.length)]

async function getAccountBalances(address) {
    let data = await provider.getCoinBalancesOwnedByAddress(address)
    let arr = data.map(obj => ({
        address: obj.details.reference.objectId,
        type: obj.details.data.type,
        balance: obj.details.data.fields.balance
    }))

    return arr.filter(coin => coin.type.includes("sui")).sort((a, b) => b.balance - a.balance)
}

async function getAddressesByPrice(signer, price) {
    let address = await signer.getAddress()
    let balances = await getAccountBalances(address)
    let balanceSum = 0;
    let array = [];

    for (let balance of balances) {
        if (balanceSum < price) {
            array.push(balance.address)
            balanceSum += +balance.balance
        }
    }

    return array
}

async function buyRandonAccessory(signer) {
    const randomAccessory = getRandomAccessory();
    const { name, price } = randomAccessory
    console.log(`Buying ${name}`);

    let coinAddress = await getAddressesByPrice(signer, price);

    let data = await signer.executeMoveCall({
        packageObjectId: contracts.VITE_PACKAGE_ID,
        module: 'capy_item',
        function: 'buy_mul_coin',
        typeArguments: [],
        arguments: [contracts.VITE_ITEM_STORE, name, coinAddress],
        gasBudget: 10000
    })

    if (data) return data.EffectsCert.effects.effects.events.find(i => i.moveEvent).moveEvent.fields.id;
}

async function addAccessoryToCapy(signer, capyId, accessoryId) {
    console.log(`Adding accessory to Capy`);

    return await signer.executeMoveCall({
        packageObjectId: contracts.VITE_PACKAGE_ID,
        module: 'capy',
        function: 'add_item',
        typeArguments: [`${contracts.VITE_PACKAGE_ID}::capy_item::CapyItem`],
        arguments: [capyId, accessoryId],
        gasBudget: 10000
    })
}

async function breedCapys(signer, firstCapy, secondCapy) {
    console.log(`Breeding capys`);

    let data = await signer.executeMoveCall({
        packageObjectId: contracts.VITE_PACKAGE_ID,
        module: 'capy',
        function: 'breed_and_keep',
        typeArguments: [],
        arguments: [contracts.VITE_REGISTRY, firstCapy, secondCapy],
        gasBudget: 10000
    })

    if (data) return data.EffectsCert.effects.effects.events.find(i => i.moveEvent).moveEvent.fields.id;
}

async function sellCapy(signer, capyId) {
    let price = (generateRandomAmount(0.01, 0.09).toFixed(2));
    console.log(`Listing new Capy for ${price} SUI`);

    let n = price * 1000000000;
    let bn = BigNumber(n)

    return await signer.executeMoveCall({
        packageObjectId: contracts.VITE_PACKAGE_ID,
        module: 'capy_market',
        function: 'list',
        typeArguments: [`${contracts.VITE_PACKAGE_ID}::capy::Capy`],
        arguments: [contracts.VITE_CAPY_MARKET, capyId, bn],
        gasBudget: 10000
    })
}

async function rotateIp() {
    console.log('Rotating IP...');
    return await axios.get(config.proxyLink).catch(err => { })
}

async function rotateAndCheckIp() {
    while (true) {
        let rotate = await rotateIp()
        console.log(rotate?.data.split('\n')[0]);
        await timeout(5000)
        let ip = await checkIp()

        if (ip) {
            console.log(`New IP: ${ip}`);
            await timeout(5000)
            return true
        }
    }
}

async function checkIp() {
    let data = await axios({
        method: 'GET',
        url: "http://api64.ipify.org/?format=json",
        proxy: {
            host: ip,
            port: Number(port),
            auth: {
                username: login,
                password: password
            },
            protocol: 'http'
        }
    }).catch(err => { console.log('[ERROR]', err.response?.data); })

    if (data) {
        return data?.data?.ip
    }
}

async function requestSuiFromFaucet(recipient) {
    while (true) {
        console.log(`Requesting SUI from faucet for 0x${recipient}`);

        let data = await axiosProxyInstance("https://faucet.devnet.sui.io/gas", {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': randUserAgent('desktop')
            },
            data: JSON.stringify({ FixedAmountRequest: { recipient: `0x${recipient}` } }),
            method: 'POST',
            timeout: 120000
        }).catch(async err => {
            let statusCode = err?.response?.status
            console.log('[FAUCET ERROR]', statusCode > 500 && statusCode < 600 ? 'Faucet down!' : err?.response?.statusText);
            await rotateAndCheckIp()
        })

        if (data?.data?.error === null) {
            console.log(`Faucet request status: ${data?.statusText || data}`);
            return true
        }
    }
}

async function waitForFaucetCoins(address) {
    console.log('Waiting for coins from faucet...');

    for (let i = 0; i < 90; i++) {
        let balance = await provider.getCoinBalancesOwnedByAddress(address)

        if (balance.length > 0) {
            return true
        } else await timeout(2000)
    }

    console.log('Waiting for coins stopped, timeout of 3 minutes exceed');
}

async function handleCapy(signer) {
    let capyId = await mintCapy(signer);
    let accessoryId = await buyRandonAccessory(signer)
    await addAccessoryToCapy(signer, capyId, accessoryId)

    return capyId
}

async function handleNFTs(mnemonic, isOld = false) {
    try {
        const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
        const address = keypair.getPublicKey().toSuiAddress();
        const signer = new RawSigner(keypair, provider);

        console.log(`Sui Address: 0x${address}`)
        !isOld && console.log(`Mnemonic: ${mnemonic}`);

        config.proxyPerWallet && await rotateAndCheckIp()
        await requestSuiFromFaucet(address)
        let gotCoins = await waitForFaucetCoins(address)

        if (gotCoins) {
            !isOld && saveMnemonic(mnemonic)

            let firstCapy = await handleCapy(signer)
            let secondCapy = await handleCapy(signer)
            let newCapy = await breedCapys(signer, firstCapy, secondCapy)
            await sellCapy(signer, newCapy)

            for (let i = 0; i < nftArray.length; i++) {
                await mintNft(signer, nftArray[i])
            }

            console.log(`https://explorer.sui.io/address/${address}?network=devnet`);
            console.log("-".repeat(100));
        }
    } catch (err) { console.log(err.message) }
}



(async () => {
    errorHandler()
    let isProxyValid = await checkIp();
    if (isProxyValid) {
        console.log(`Proxy is valid`);
        if (config.oldWallets) {
            let mnemonics = parseFile('oldWallets.txt');
            console.log(`Loaded ${mnemonics.length} wallets`);

            for (let i = 0; i < mnemonics.length; i++) {
                const mnemonic = mnemonics[i]
                const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
                const address = keypair.getPublicKey().toSuiAddress();
                let balance = await provider.getCoinBalancesOwnedByAddress(address)

                if (balance.length === 0) {
                    await handleNFTs(mnemonic, true) // skip wallets with already minted nfts
                } else console.log(`Wallet ${address} has already has NFT`);
            }
        } else {
            while (true) {
                const mnemonic = bip39.generateMnemonic();
                await handleNFTs(mnemonic)
            }
        }
    } console.log(`Invalid proxy`);
})()