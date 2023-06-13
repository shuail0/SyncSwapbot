const { Wallet, Provider } = require('zksync-web3');
// const zksync = require('zksync-web3');
const ethers = require('ethers');
const { defaultAbiCoder } = require('ethers').utils;
const { BigNumber } = require('ethers');
const { approveToken } = require('./erc20utils');
const fs = require('fs');
const { convertCSVToObjectSync, sleep, getRandomFloat, saveLog } = require('./utils');
const { count } = require('console');


// ------------主网网配置-----------
// 配置RPC

// const zksrpc = 'https://mainnet.era.zksync.io';
// const ethereumrpc = 'https://eth-mainnet.g.alchemy.com/v2/qRnk4QbaEmXJEs5DMnhitC0dSow-qATl';
// const provider = new Provider(zksrpc);
// const ethereumProvider = new ethers.getDefaultProvider(ethereumrpc);

// // 设置代币地址
// const wETHAddress = '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91';
// const usdcAddress = '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4';
// const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
// const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

// // 设置合约地址
// const factoryAddress = '0xf2DAd89f2788a8CD54625C60b55cD3d2D0ACa7Cb';
// const routerAddress = '0x2da10A1e27bF85cEdD8FFb1AbBe97e53391C0295';
// ----------------------------------------------------------------------

// ------------测试网配置-----------
// 配置RPC

const zksrpc = 'https://testnet.era.zksync.dev';
const ethereumrpc = 'https://eth-mainnet.g.alchemy.com/v2/qRnk4QbaEmXJEs5DMnhitC0dSow-qATl';
const provider = new Provider(zksrpc);
const ethereumProvider = new ethers.getDefaultProvider(ethereumrpc);

// 设置代币地址
const wETHAddress = '0x20b28b1e4665fff290650586ad76e977eab90c5d';
const usdcAddress = '0xfcEd12dEbc831D3a84931c63687C395837D42c2B';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

// 设置合约地址
const factoryAddress = '0xf2FD2bc2fBC12842aAb6FbB8b1159a6a83E72006';
const routerAddress = '0xB3b7fCbb8Db37bC6f572634299A58f51622A847e';
// -----------------------------------------

// 设定项目名称，保存日志用
const projectName = 'SyncSwap';
// 设定最大GAS，主网GAS高于这个值程序不执行
const maxGasPrice = 30;
// 设定随机交易金额比例 
const minAmountPct = 0.2;
const maxAmountPct = 0.3;

// 设定账户随机间隔时间区间
const minSleepTime = 1;
const maxSleepTime = 5;

// 设置钱包文件路径
const walletPath = '/Users/lishuai/Documents/crypto/ bockchainbot/SyncSwapbot/data/walletData.csv';



// 程序开始运行
console.log('正在打开钱包文件...')
//  打开地址文件
const walletData = convertCSVToObjectSync(walletPath);

async function tokenSwap(poolAddress, tokenIn, amountIn, wallet){
    // 交易模式：
    // 1 - 提取并解包装到原生ETH
    // 2 - 提取并包装到wETH
    const withdrawMode = 1;
    // console.log(wallet.address);
    // process.exit();

    // 构建交易参数
    const swapData = defaultAbiCoder.encode(
        ["address", "address", "uint8"],
        [tokenIn, wallet.address, withdrawMode]
    );
    const steps = [{
        pool: poolAddress,
        data: swapData,
        callback: ZERO_ADDRESS, // we don't have a callback
        callbackData: '0x',
    }];

    if (tokenIn === wETHAddress){
        tokenIn = ZERO_ADDRESS;
    };
    const paths = [{
        steps: steps,
        tokenIn: tokenIn,
        amountIn: amountIn,
    }];
 
    // 创建router合约
    const routerABI = JSON.parse(fs.readFileSync('./ABI/SyncSwapRouter.json'));
    const router = new ethers.Contract(routerAddress, routerABI, wallet);
    

    // params
    const params = {};
    // 使用原生ETH支付时，需要传入value参数
    if (paths[0].tokenIn === ZERO_ADDRESS){
        params.value = amountIn
    };
    // 获取gas价格
    params.gasPrice = await provider.getGasPrice();
    // 估计交易所需的 gas limit
    params.gasLimit = await router.estimateGas.swap(paths, 0, BigNumber.from(Math.floor(Date.now() / 1000)).add(1800), params);

    // 开始兑换
    const response = await router.swap(
        paths,
        0,
        BigNumber.from(Math.floor(Date.now() / 1000)).add(1800),
        params
    );
    // console.log(response)
    const tx = await response.wait();
    return tx;
}


async function main() {
    // 查询Pool合约地址
    const factoryABI = JSON.parse(fs.readFileSync('./ABI/BasePoolFactory.json'));
    const classicPoolFactory = new ethers.Contract(factoryAddress, factoryABI, provider);
    console.log('获取Pool合约地址...')
    const poolAddress = await classicPoolFactory.getPool(wETHAddress, usdcAddress);
    console.log(`成功获取Pool合约地址：${poolAddress}`);
    
    console.log('开始循环...')
    for(wt of walletData){

        // 循环获取GAS
        while (true) {
            console.log('开始获取当前主网GAS');
            const gasPrice = parseFloat(ethers.utils.formatUnits(await ethereumProvider.getGasPrice(), 'gwei'));
            console.log(`当前gasPrice：${gasPrice}`);
            if (gasPrice > maxGasPrice) {
                console.log(`gasPrice高于设定的最大值${maxGasPrice}，程序暂停30分钟`)
                await sleep(30);
            } else {
                console.log(`gasPrice低于${maxGasPrice}，程序继续执行`) 
                break;
            };
        }
        
        console.log(`帐号：${wt.Wallet}, 地址：${wt.Address}， 开始执行交易...`);
        // 创建钱包
        const wallet = new Wallet(wt.PrivateKey).connect(provider).connectToL1(ethereumProvider);
        // 查询账户余额
        console.log('开始查询账户ETH余额.')
        const ethBalance = parseFloat(ethers.utils.formatEther(await wallet.getBalance(ETH_ADDRESS)));
        console.log(`成功查询账户ETH余额，余额：${ethBalance}`);
        const minAmount = ethBalance * minAmountPct;
        const maxAmount = ethBalance * maxAmountPct;

        // 设定随机交易金额
        const randomAmount = getRandomFloat(minAmount, maxAmount).toFixed(16);
        // const randomAmount = 0.001;
        const tradingamount = ethers.utils.parseEther(randomAmount.toString());
        console.log(`trading Amount ${tradingamount}`)

        // 卖出ETH，获得USDC
        console.log('卖出ETH')
        let tx = await tokenSwap(poolAddress, wETHAddress, tradingamount, wallet);
        console.log(`交易成功，哈希：${tx.transactionHash}`);
       
        console.log('暂停1分钟后继续');
        await sleep(1);


        // 查询USDC余额
        console.log('开始查询USDC余额...');

        const tokenBalance = await provider.getBalance(wallet.address, "latest", usdcAddress);
        console.log(`查询成功，USDC余额：${tokenBalance}，开始授权...`);

        // 授权USDC
        const txReceipt = await approveToken(wallet, usdcAddress, routerAddress, tokenBalance);
        console.log('授权成功,哈希:', txReceipt.transactionHash);

        // console.log('暂停1分钟后继续');
        // await sleep(1);

        console.log('使用USDC买入ETH...')
        // 卖出USDC，获得ETH
        tx = await tokenSwap(poolAddress, usdcAddress, tokenBalance, wallet);
        console.log(`交易成功，哈希：${tx.transactionHash}`);

        // 保存日志
        const currentTime = new Date().toISOString();
        const logMessage = `成功执行 - 时间: ${currentTime}, 钱包名称: ${wt.Wallet},钱包地址: ${wallet.address}`;
        saveLog(projectName, logMessage);
        // 暂停
        const sleepTime = getRandomFloat(minSleepTime, maxSleepTime).toFixed(1); 
        console.log(logMessage, '程序暂停',sleepTime,'分钟后继续执行');
        await sleep(sleepTime);

    }

}

main()
