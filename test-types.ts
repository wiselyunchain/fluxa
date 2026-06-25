import * as sdk from "@umbra-privacy/sdk";

console.log(Object.keys(sdk).filter(k => k.toLowerCase().includes("merkle") || k.toLowerCase().includes("relayer") || k.toLowerCase().includes("fetch")));
