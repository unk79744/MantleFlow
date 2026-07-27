export const SUBSCRIPTION_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SUBSCRIPTION_CONTRACT || "0x0000000000000000000000000000000000000000";

export const SUBSCRIPTION_ABI = [
  {
    "inputs": [],
    "name": "subscribe",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;