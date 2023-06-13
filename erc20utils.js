const ethers = require('ethers');
const fs = require('fs');

async function approveToken(wallet, tokenAddress, spender, approveValue) {
    const tokenABI = JSON.parse(fs.readFileSync('./ABI/erc20.json'));
    const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);
    const txApprove = await tokenContract.approve(spender, approveValue);
    return await txApprove.wait();
}

module.exports = {
    approveToken
};
