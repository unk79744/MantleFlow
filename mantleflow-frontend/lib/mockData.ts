import type { TokenItem } from "./types";

export const MANTLE_TOKEN_LIST: TokenItem[] = [
  { address: "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8", symbol: "WMNT", decimals: 18 },
  { address: "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000", symbol: "MNT", decimals: 18 },
  { address: "0x201eba5cc46d216ce6dc03f6a759e8e766e956ae", symbol: "USDT", decimals: 6 },
  { address: "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9", symbol: "USDC", decimals: 6 },
  { address: "0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111", symbol: "WETH", decimals: 18 },
  { address: "0xcabae6f6ea1ecab08ad02fe02ce9a44f09aebfa2", symbol: "WBTC", decimals: 8 },
  { address: "0xcda86a272531e8640cd7f1a92c01839911b90bb0", symbol: "mETH", decimals: 18 },
  { address: "0xe6829d9a7ee3040e1276fa75293bde931859e8fa", symbol: "cmETH", decimals: 18 },
  { address: "0x5be26527e817998a7206475496fde1e68957c5a6", symbol: "USDY", decimals: 18 },
  { address: "0xc96de26018a54d51c097160568752c4e3bd6c364", symbol: "fBTC", decimals: 8 },
  { address: "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34", symbol: "USDe", decimals: 18 },
  { address: "0x9f0c013016e8656bc256f948cd4b79ab25c7b94d", symbol: "COOK", decimals: 18 },
  { address: "0x4515a45337f461a11ff0fe8abf3c606ae5dc00c9", symbol: "MOE", decimals: 18 },
  { address: "0x26a6b0dcdcfb981362afa56d581e4a7dba3be140", symbol: "PUFF", decimals: 18 },
  { address: "0x25356aeca4210ef7553140edb9b8026089e49396", symbol: "LEND", decimals: 18 },
];

export const USD_PRESETS = [1000, 10000, 50000, 100000] as const;