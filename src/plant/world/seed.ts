/** Cross-platform repeatable xorshift32. Never uses Math.random. */
export const seedValue=(seed:number):number=>{
 if(!Number.isSafeInteger(seed))throw new RangeError('Seed must be an integer');
 const n=seed>>>0;
 return n===0?0x6d2b79f5:n;
};
export function nextSeed(state:number):{state:number;unit:number}{
 let x=seedValue(state);
 x^=x<<13;x^=x>>>17;x^=x<<5;
 x>>>=0;
 return {state:x,unit:x/4294967296};
}
