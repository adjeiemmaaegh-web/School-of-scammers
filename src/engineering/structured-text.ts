/** Bounded deterministic teaching subset of IEC 61131-3 Structured Text.
 * This is NOT a vendor parser, real PLC runtime, or safety-rated controller. */
export type STValue=number|boolean;
export type STSignals=Readonly<Record<string,STValue>>;
export type STType='BOOL'|'INT'|'DINT'|'REAL'|'LREAL';
/** Standard function blocks supported as instances: timers, counters and edge detectors (see docs/product/PLC_SUBSET.md). */
export type FbType='TON'|'TOF'|'TP'|'CTU'|'CTD'|'R_TRIG'|'F_TRIG'|'PID';
/** The engine's fixed scan period; timer function blocks advance by this each scan (the simulator scan is 50 ms). */
export const ST_SCAN_MS=50;
/** Capacity (R08): declarations per program and statements executed per scan. Both are hard, measurable budgets (raised from 128 and 400). */
export const ST_MAX_DECLARATIONS=512;
/** Source size guard (raised from 12,000): bounds compile time and project size. */
export const ST_MAX_SOURCE_CHARS=64000;
/** Token guard (raised from 3,000), sized so a program at the statement budget still compiles. */
export const ST_MAX_TOKENS=40000;
export const ST_MAX_STATEMENTS_PER_SCAN=5000;
const FB_SPEC:Readonly<Record<FbType,{inputs:readonly string[];outputs:readonly {name:string;type:STType}[];hidden:readonly string[];hiddenReal?:readonly string[]}>>={
 TON:{inputs:['IN','PT'],outputs:[{name:'Q',type:'BOOL'},{name:'ET',type:'DINT'}],hidden:[]},
 TOF:{inputs:['IN','PT'],outputs:[{name:'Q',type:'BOOL'},{name:'ET',type:'DINT'}],hidden:[]},
 TP:{inputs:['IN','PT'],outputs:[{name:'Q',type:'BOOL'},{name:'ET',type:'DINT'}],hidden:['RUN','PIN']},
 CTU:{inputs:['CU','R','PV'],outputs:[{name:'Q',type:'BOOL'},{name:'CV',type:'INT'}],hidden:['PCU']},
 CTD:{inputs:['CD','LD','PV'],outputs:[{name:'Q',type:'BOOL'},{name:'CV',type:'INT'}],hidden:['PCD']},
 R_TRIG:{inputs:['CLK'],outputs:[{name:'Q',type:'BOOL'}],hidden:['PCLK']},
 F_TRIG:{inputs:['CLK'],outputs:[{name:'Q',type:'BOOL'}],hidden:['PCLK']},
 /** Teaching PID: positional form with output clamp and conditional-integration anti-windup; KI/KD are per second. Not a tuned industrial controller. */
 PID:{inputs:['PV','SP','KP','KI','KD','OUT_MIN','OUT_MAX'],outputs:[{name:'OUT',type:'REAL'}],hidden:['PRIMED'],hiddenReal:['INTEG','PERR']},
};
const isFbType=(name:string):name is FbType=>Object.prototype.hasOwnProperty.call(FB_SPEC,name);
/** Storage name of an instance member; plain identifiers so it round-trips through the scan memory (collisions are rejected as duplicates). */
const fbKey=(instance:string,member:string)=>`${instance}__${member}`.toUpperCase();
export type STDeclaration={name:string;type:STType;scope:'input'|'output'|'local';initial:STValue};
type Token={value:string;offset:number};
type Expression={kind:'literal';value:STValue}|{kind:'read';name:string}|{kind:'unary';op:string;inner:Expression}|{kind:'binary';op:string;left:Expression;right:Expression}|{kind:'call';name:'ABS'|'MIN'|'MAX'|'LIMIT'|'SQRT'|'SIN'|'COS'|'TAN'|'ATAN'|'LN'|'LOG'|'EXP'|'TRUNC'|'SCALE';args:Expression[]}|{kind:'index';name:string;low:number;high:number;index:Expression};
type Statement={kind:'assign';name:string;expr:Expression}|{kind:'fb';instance:string;type:FbType;args:Record<string,Expression>}|{kind:'if';branches:{when:Expression;body:Statement[]}[];otherwise:Statement[]}|{kind:'case';selector:Expression;arms:{value:STValue;body:Statement[]}[];otherwise:Statement[]}|{kind:'for';counter:string;from:Expression;to:Expression;step:Expression;body:Statement[]}|{kind:'while';condition:Expression;body:Statement[]}|{kind:'assignIndex';name:string;low:number;high:number;index:Expression;expr:Expression};
export type STProgram={source:string;bodySource:string;statements:readonly Statement[];referencedInputs:string[];assignedOutputs:string[];declarations:readonly STDeclaration[]};
export type STResult={outputs:Record<string,STValue>;signals:Record<string,STValue>;assignments:{tag:string;value:STValue}[];memory:Record<string,STValue>};
const keyword=(s:string)=>s.toUpperCase();
const identifier=/^[A-Za-z][A-Za-z0-9_]*$/;
const number=/^(?:\d+(?:\.\d+)?|\.\d+)$/;
const BUILTINS = new Set(['ABS','MIN','MAX','LIMIT','SQRT','SIN','COS','TAN','ATAN','LN','LOG','EXP','TRUNC','SCALE']);
const ONE_ARG=new Set(['ABS','SQRT','SIN','COS','TAN','ATAN','LN','LOG','EXP','TRUNC']);
/** R07 limits: array length, user function / function block call depth. */
export const ST_MAX_ARRAY_ELEMENTS=64, ST_MAX_CALL_DEPTH=6;
type UserDef={kind:'function'|'block';name:string;result?:STType;members:{name:string;type:STType|FbType;scope:'input'|'output'|'local';initial:STValue}[];body:Token[]};
const precedence:Readonly<Record<string,number>>={OR:1,XOR:2,AND:3,'=':4,'<>':4,'<':4,'<=':4,'>':4,'>=':4,'+':5,'-':5,'*':6,'/':6,MOD:6};
const RESERVED=new Set(['TON','TOF','TP','CTU','CTD','R_TRIG','F_TRIG','PID','IF','THEN','ELSIF','ELSE','END_IF','AND','OR','XOR','NOT','TRUE','FALSE','MOD','VAR','VAR_INPUT','VAR_OUTPUT','END_VAR','BOOL','INT','DINT','REAL','LREAL','CASE','OF','END_CASE','FOR','TO','BY','DO','END_FOR','WHILE','END_WHILE','ARRAY','TYPE','END_TYPE','STRUCT','END_STRUCT','FUNCTION','END_FUNCTION','FUNCTION_BLOCK','END_FUNCTION_BLOCK']);
function tokenize(source:string):Token[]{
 if(typeof source!=='string'||source.length>ST_MAX_SOURCE_CHARS)throw new RangeError(`Structured Text must be at most ${ST_MAX_SOURCE_CHARS.toLocaleString('en-US')} characters`);
 const tokens:Token[]=[];
 for(let i=0;i<source.length;){
  if(/\s/.test(source[i])){i++;continue;}
  if(source.slice(i,i+2)==='//'){const end=source.indexOf('\n',i+2);i=end<0?source.length:end+1;continue;}
  if(source.slice(i,i+2)==='(*'){const end=source.indexOf('*)',i+2);if(end<0)throw new SyntaxError(`Unterminated comment at ${i}`);i=end+2;continue;}
  const rest=source.slice(i);
  const match=/^(?:[Tt]#(?:\d+(?:\.\d+)?(?:ms|s|m|h))+|(?:\d+(?:\.\d+)?|\.\d+)(?![A-Za-z_])|[A-Za-z][A-Za-z0-9_]*|:=|<=|>=|<>|\.\.|[=<>+*\/\-();:,.\[\]])/.exec(rest);
  if(!match)throw new SyntaxError(`Unexpected character at ${i}: ${source[i]}`);
  tokens.push({value:match[0],offset:i});i+=match[0].length;
  if(tokens.length>ST_MAX_TOKENS)throw new RangeError(`Structured Text token limit (${ST_MAX_TOKENS.toLocaleString('en-US')}) exceeded`);
 }
 tokens.push({value:'<EOF>',offset:source.length});return tokens;
}
/** Teaching numeric bounds: INT 16-bit, DINT signed 32-bit, REAL/LREAL finite JS numbers (not IEC float precision). */
function checkType(type:STType,value:STValue,name:string):void{
 if(type==='BOOL'){if(typeof value!=='boolean')throw new TypeError(`${name} requires BOOL`);return;}
 if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${name} requires numeric ${type}`);
 if(type==='INT'&&(!Number.isInteger(value)||value<-32768||value>32767))throw new RangeError(`${name} requires INT in -32768..32767`);
 if(type==='DINT'&&(!Number.isInteger(value)||value<-2147483648||value>2147483647))throw new RangeError(`${name} requires DINT in -2147483648..2147483647`);
}
/**
 * R07: pull `FUNCTION ... END_FUNCTION` and `FUNCTION_BLOCK ... END_FUNCTION_BLOCK` definitions out of the token stream.
 * Definitions must come before the program's own TYPE / VAR blocks. Parameters and locals are scalar (a function block may also
 * hold standard timer/counter/edge instances). Bodies are kept as tokens and inlined, with renamed variables, wherever they are used.
 */
function extractDefinitions(all:Token[]):{rest:Token[];defs:Map<string,UserDef>}{
 const defs=new Map<string,UserDef>();const rest:Token[]=[];
 const SCALARS=['BOOL','INT','DINT','REAL','LREAL'];
 let i=0;
 const fail=(m:string,at:number):never=>{throw new SyntaxError(`${m} at offset ${all[Math.min(at,all.length-1)].offset}`);};
 while(i<all.length){
  const head=keyword(all[i].value);
  if(head!=='FUNCTION'&&head!=='FUNCTION_BLOCK'){rest.push(all[i]);i++;continue;}
  if(rest.some(t=>['VAR','VAR_INPUT','VAR_OUTPUT','TYPE'].includes(keyword(t.value))))fail('Definitions must precede the program VAR and TYPE blocks',i);
  const kind=head==='FUNCTION'?'function':'block',end=kind==='function'?'END_FUNCTION':'END_FUNCTION_BLOCK';
  i++;const nameTok=all[i];
  if(!nameTok||!identifier.test(nameTok.value)||RESERVED.has(keyword(nameTok.value))||BUILTINS.has(keyword(nameTok.value)))fail(`Invalid ${kind} name`,i);
  const name=keyword(nameTok.value);if(defs.has(name))fail(`Duplicate definition ${nameTok.value}`,i);
  i++;let result:STType|undefined;
  if(kind==='function'){
   if(all[i]?.value!==':')fail('A FUNCTION needs a return type (name : TYPE)',i);
   const t=keyword(all[i+1]?.value??'');if(!SCALARS.includes(t))fail('A FUNCTION returns BOOL, INT, DINT, REAL or LREAL',i+1);
   result=t as STType;i+=2;
  }
  const members:UserDef['members']=[];
  while(['VAR','VAR_INPUT','VAR_OUTPUT'].includes(keyword(all[i]?.value??''))){
   const header=keyword(all[i].value);const scope=header==='VAR_INPUT'?'input':header==='VAR_OUTPUT'?'output':'local';i++;
   if(kind==='function'&&scope==='output')fail('A FUNCTION returns through its name; VAR_OUTPUT is only for function blocks',i);
   while(keyword(all[i]?.value??'')!=='END_VAR'){
    if(!all[i]||all[i].value==='<EOF>')fail('Unterminated variable block in definition',i);
    const mname=all[i].value;
    if(!identifier.test(mname)||RESERVED.has(keyword(mname)))fail('Invalid member name',i);
    if(members.some(m=>keyword(m.name)===keyword(mname))||keyword(mname)===name)fail(`Duplicate member ${mname}`,i);
    if(all[i+1]?.value!==':')fail('Expected :',i+1);
    const type=keyword(all[i+2]?.value??'');i+=3;
    const std=isFbType(type);
    if(!std&&!SCALARS.includes(type))fail(`Unsupported member type ${type}`,i-1);
    if(std&&(kind==='function'||scope!=='local'))fail('Standard function blocks may only be locals of a FUNCTION_BLOCK',i-1);
    let initial:STValue=type==='BOOL'?false:0;
    if(!std&&all[i]?.value===':='){
     if(scope==='input'){/* defaults for inputs are allowed in definitions */}
     i++;let sign=1;if(all[i].value==='-'){sign=-1;i++;}else if(all[i].value==='+')i++;
     const lit=all[i];i++;const lu=keyword(lit.value);
     if(lu==='TRUE'||lu==='FALSE')initial=lu==='TRUE';else if(number.test(lit.value))initial=sign*Number(lit.value);else fail('Expected literal initializer',i-1);
     checkType(type as STType,initial,mname);
    }
    if(all[i]?.value!==';')fail('Expected ;',i);i++;
    members.push({name:mname,type:std?(type as FbType):(type as STType),scope,initial});
    if(members.length>64)throw new RangeError('A definition may declare at most 64 members');
   }
   i++;
  }
  const body:Token[]=[];
  while(i<all.length&&keyword(all[i].value)!==end){
   if(all[i].value==='<EOF>')fail(`Unterminated ${kind} (missing ${end})`,i);
   const k=keyword(all[i].value);
   if(k==='FUNCTION'||k==='FUNCTION_BLOCK')fail('Definitions cannot be nested',i);
   body.push(all[i]);i++;
  }
  if(i>=all.length)fail(`Unterminated ${kind} (missing ${end})`,i);
  i++;if(all[i]?.value===';')i++;
  if(!body.length)fail(`${nameTok.value} has an empty body`,i-1);
  for(let k=0;k<body.length-1;k++)if(keyword(body[k].value)===name&&body[k+1].value==='(')fail(`${nameTok.value} calls itself; recursion is not supported`,i-1);
  defs.set(name,{kind,name:nameTok.value,result,members,body});
 }
 return {rest,defs};
}
export function compileStructuredText(source:string):STProgram{
 const extracted=extractDefinitions(tokenize(source));let tokens=extracted.rest;const userDefs=extracted.defs;let pos=0;let statementCount=0;const reads=new Map<string,string>();const writes=new Map<string,string>();const declarations:STDeclaration[]=[];const namedDeclarations=new Set<string>();const fbInstances=new Map<string,FbType>();
 const peek=()=>tokens[pos].value, upper=()=>keyword(peek());
 const next=()=>tokens[pos++].value;
 const fail=(reason:string):never=>{throw new SyntaxError(`${reason} at offset ${tokens[Math.min(pos,tokens.length-1)].offset}`);};
 const accept=(value:string)=>{if(upper()===value){pos++;return true;}return false;};
 const requireToken=(value:string)=>{if(!accept(value))fail(`Expected ${value}, found ${peek()}`);};
 const readName=()=>{const t=peek();if(!identifier.test(t)||RESERVED.has(upper()))fail(`Expected variable name, found ${t}`);pos++;return t;};
 // R07 aggregate and user-code state. Arrays and structures are flattened into scalar declarations (so scan memory, the
 // capacity limits and type checks all apply unchanged); user functions and function blocks are inlined with renamed variables.
 const arrays=new Map<string,{name:string;low:number;high:number;type:STType}>();
 const structs=new Map<string,{fields:{name:string;type:STType;initial:STValue}[]}>();
 const structInstances=new Map<string,string>();
 const userInstances=new Map<string,UserDef>();
 let pending:Statement[]=[];let callCounter=0;let callDepth=0;let noHoist=false;
 const SCALAR_TYPES=['BOOL','INT','DINT','REAL','LREAL'];
 const declareScalar=(name:string,type:STType,scope:STDeclaration['scope'],initial:STValue)=>{
  const key=keyword(name);
  if(declarations.length>=ST_MAX_DECLARATIONS)throw new RangeError(`Structured Text declaration limit (${ST_MAX_DECLARATIONS}) exceeded`);
  if(namedDeclarations.has(key))fail(`Duplicate variable declaration ${name}`);
  checkType(type,initial,name);namedDeclarations.add(key);declarations.push({name,type,scope,initial});
 };
 const declareStd=(key:string,typeName:FbType)=>{
  namedDeclarations.add(key);fbInstances.set(key,typeName);
  // The synthetic storage variables reserve their names so a user variable can never alias an instance's state.
  for(const o of FB_SPEC[typeName].outputs){const n=fbKey(key,o.name);namedDeclarations.add(n);declarations.push({name:n,type:o.type,scope:'local',initial:o.type==='BOOL'?false:0});}
  for(const h of FB_SPEC[typeName].hidden){const n=fbKey(key,h);namedDeclarations.add(n);declarations.push({name:n,type:'BOOL',scope:'local',initial:false});}
  for(const h of FB_SPEC[typeName].hiddenReal??[]){const n=fbKey(key,h);namedDeclarations.add(n);declarations.push({name:n,type:'REAL',scope:'local',initial:0});}
 };
 const signedInt=():number=>{let sign=1;if(accept('-'))sign=-1;else accept('+');const t=next();if(!/^\d+$/.test(t))fail(`Expected integer, found ${t}`);return sign*Number(t);};
 const memberKey=(prefix:string,member:string)=>keyword(prefix)+'__'+keyword(member);
 const emitAssign=(key:string,expr:Expression):Statement=>{if(!writes.has(key))writes.set(key,key);return {kind:'assign',name:key,expr};};
 const literalOf=(type:STType):Expression=>({kind:'literal',value:type==='BOOL'?false:0});
 /** Inline a user definition's body with its members renamed to `<prefix>__<member>`. */
 const instantiate=(def:UserDef,prefix:string):Statement[]=>{
  if(callDepth>=ST_MAX_CALL_DEPTH)throw new RangeError(`Call depth limit (${ST_MAX_CALL_DEPTH}) exceeded; recursion is not supported`);
  const map=new Map<string,string>();
  for(const m of def.members)map.set(keyword(m.name),memberKey(prefix,m.name));
  if(def.kind==='function')map.set(keyword(def.name),memberKey(prefix,def.name));
  const renamed:Token[]=def.body.map(t=>{const m=identifier.test(t.value)?map.get(keyword(t.value)):undefined;return m?{value:m,offset:t.offset}:t;});
  renamed.push({value:'<EOF>',offset:def.body[def.body.length-1].offset});
  const saved={tokens,pos};tokens=renamed;pos=0;callDepth++;
  try{const body=statements(new Set());if(peek()!=='<EOF>')fail(`Unexpected token ${peek()} in ${def.name}`);return body;}
  finally{tokens=saved.tokens;pos=saved.pos;callDepth--;}
 };
 function expression(minPrec=1,depth=0):Expression{
  if(depth>40)throw new RangeError('Expression nesting limit exceeded');
  const t=next(),u=keyword(t);let left!:Expression;
  if(t==='('){left=expression(1,depth+1);requireToken(')');}
  else if(u==='NOT'||t==='+'||t==='-')left={kind:'unary',op:u,inner:expression(7,depth+1)};
  else if(u==='TRUE'||u==='FALSE')left={kind:'literal',value:u==='TRUE'};
  else if(number.test(t)){const value=Number(t);if(!Number.isFinite(value))fail('Nonfinite numeric literal');left={kind:'literal',value};}
  else if(/^T#/i.test(t)){
   // T#1m30s500ms style duration literal, evaluated to whole milliseconds (DINT).
   let ms=0;for(const part of t.slice(2).matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g))ms+=Number(part[1])*({ms:1,s:1000,m:60000,h:3600000} as Record<string,number>)[part[2]];
   if(!Number.isFinite(ms)||ms<0||ms>2147483647)fail('Duration literal out of range (0..2,147,483,647 ms)');
   left={kind:'literal',value:Math.round(ms)};
  }
  else if(identifier.test(t)&&BUILTINS.has(u)&&peek()==='('){
   next();const args:Expression[]=[];
   if(peek()!==')'){
    do{args.push(expression(1,depth+1));if(args.length>(u==='SCALE'?5:4))fail('Too many function arguments');}
    while(accept(','));
   }
   requireToken(')');
   if((ONE_ARG.has(u)&&args.length!==1)||(u==='LIMIT'&&args.length!==3)||(u==='SCALE'&&args.length!==5)||
      ((u==='MIN'||u==='MAX')&&(args.length<2||args.length>4)))
     fail('Unsupported function arity '+u);
   left={kind:'call',name:u as Extract<Expression,{kind:'call'}>['name'],args};
  }
  else if(identifier.test(t)&&!RESERVED.has(u)&&userDefs.get(u)?.kind==='function'&&peek()==='('){
   // R07 user function: hoisted into statements that run just before the statement containing the call.
   if(noHoist)fail('User function calls are not allowed in a WHILE condition');
   const def=userDefs.get(u)!;next();const args:Expression[]=[];
   if(peek()!==')'){do{args.push(expression(1,depth+1));if(args.length>16)fail('Too many function arguments');}while(accept(','));}
   requireToken(')');
   const inputs=def.members.filter(m=>m.scope==='input');
   if(args.length!==inputs.length)fail(`${def.name} takes ${inputs.length} argument(s), got ${args.length}`);
   const prefix=`${u}__C${callCounter++}`;
   for(const m of def.members)declareScalar(memberKey(prefix,m.name),m.type as STType,'local',m.initial);
   declareScalar(memberKey(prefix,def.name),def.result!,'local',def.result==='BOOL'?false:0);
   inputs.forEach((m,i)=>pending.push(emitAssign(memberKey(prefix,m.name),args[i])));
   for(const m of def.members.filter(x=>x.scope!=='input'))pending.push(emitAssign(memberKey(prefix,m.name),{kind:'literal',value:m.initial}));
   pending.push(emitAssign(memberKey(prefix,def.name),literalOf(def.result!)));
   pending.push(...instantiate(def,prefix));
   const resultKey=memberKey(prefix,def.name);reads.set(resultKey,resultKey);left={kind:'read',name:resultKey};
  }
  else if(identifier.test(t)&&!RESERVED.has(u)&&arrays.has(u)&&peek()==='['){
   const arr=arrays.get(u)!;next();const index=expression(1,depth+1);requireToken(']');
   if(index.kind==='literal'&&(typeof index.value!=='number'||!Number.isSafeInteger(index.value)||index.value<arr.low||index.value>arr.high))
    fail(`Array index outside ${arr.name}[${arr.low}..${arr.high}]`);
   for(let k=0;k<arr.high-arr.low+1;k++){const key=`${u}__${k}`;reads.set(key,key);}
   left={kind:'index',name:u,low:arr.low,high:arr.high,index};
  }
  else if(identifier.test(t)&&!RESERVED.has(u)&&structInstances.has(u)&&peek()==='.'){
   next();const field=next(),def=structs.get(structInstances.get(u)!)!;
   if(!def.fields.some(f=>keyword(f.name)===keyword(field)))fail(`${t}.${field} is not a field of ${structInstances.get(u)}`);
   const key=memberKey(u,field);reads.set(key,key);left={kind:'read',name:key};
  }
  else if(identifier.test(t)&&!RESERVED.has(u)&&userInstances.has(u)&&peek()==='.'){
   next();const member=next(),def=userInstances.get(u)!;
   if(!def.members.some(m=>m.scope==='output'&&keyword(m.name)===keyword(member)))fail(`${t}.${member} is not an output of ${def.name}`);
   const key=memberKey(u,member);reads.set(key,key);left={kind:'read',name:key};
  }
  else if(identifier.test(t)&&!RESERVED.has(u)&&peek()==='.'){
   // Function-block output such as tm.Q or c.CV; only declared instances and their real outputs are readable.
   const type=fbInstances.get(u);if(!type)fail(`${t} is not a function block instance`);
   next();const member=keyword(next());
   if(!FB_SPEC[type!].outputs.some(o=>o.name===member))fail(`${t}.${member} is not an output of ${type}`);
   const key=fbKey(u,member);reads.set(key,key);left={kind:'read',name:key};
  }
  else if(identifier.test(t)&&!RESERVED.has(u)){reads.set(u,reads.get(u)??t);left={kind:'read',name:u};}
  else fail(`Expected expression, found ${t}`);
  while(true){const op=upper(),prec=precedence[op];if(prec===undefined||prec<minPrec)break;next();const right=expression(prec+1,depth+1);left={kind:'binary',op,left,right};}
  return left;
 }
 // Declaration blocks are restricted to the beginning of the program. Unsupported
 // qualifiers, aggregate types and vendor syntax fail closed rather than being ignored.
 while(['VAR','VAR_INPUT','VAR_OUTPUT','TYPE'].includes(upper())){
  if(upper()==='TYPE'){
   next();const structName=readName(),structKey=keyword(structName);
   if(structs.has(structKey)||namedDeclarations.has(structKey))fail(`Duplicate type ${structName}`);
   requireToken(':');requireToken('STRUCT');
   const fields:{name:string;type:STType;initial:STValue}[]=[];
   while(upper()!=='END_STRUCT'){
    if(peek()==='<EOF>')fail('Unterminated STRUCT');
    if(fields.length>=32)throw new RangeError('A STRUCT may have at most 32 fields');
    const fname=readName();if(fields.some(f=>keyword(f.name)===keyword(fname)))fail(`Duplicate field ${fname}`);
    requireToken(':');const ft=upper();if(!SCALAR_TYPES.includes(ft))fail(`Unsupported field type ${peek()}`);next();
    let initial:STValue=ft==='BOOL'?false:0;
    if(accept(':=')){let sign=1;if(accept('-'))sign=-1;else accept('+');const tok=next(),tu=keyword(tok);
     if(tu==='TRUE'||tu==='FALSE')initial=tu==='TRUE';else if(number.test(tok))initial=sign*Number(tok);else fail(`Expected literal initializer, found ${tok}`);
     checkType(ft as STType,initial,fname);}
    requireToken(';');fields.push({name:fname,type:ft as STType,initial});
   }
   if(!fields.length)fail('A STRUCT needs at least one field');
   requireToken('END_STRUCT');accept(';');requireToken('END_TYPE');accept(';');
   structs.set(structKey,{fields});continue;
  }
  const header=keyword(next());const scope:STDeclaration['scope']=header==='VAR_INPUT'?'input':header==='VAR_OUTPUT'?'output':'local';
  let count=0;
  while(upper()!=='END_VAR'){
   if(peek()==='<EOF>')fail('Unterminated variable declaration block');
   if(declarations.length>=ST_MAX_DECLARATIONS)throw new RangeError(`Structured Text declaration limit (${ST_MAX_DECLARATIONS}) exceeded`);
   const name=readName(),key=keyword(name);
   if(namedDeclarations.has(key))fail(`Duplicate variable declaration ${name}`);
   requireToken(':');
   const typeName=upper();
   if(typeName==='ARRAY'){
    next();requireToken('[');const low=signedInt();requireToken('..');const high=signedInt();requireToken(']');requireToken('OF');
    const elementType=upper();if(!SCALAR_TYPES.includes(elementType))fail(`Unsupported array element type ${peek()}`);next();
    const length=high-low+1;
    if(!Number.isSafeInteger(length)||length<1||length>ST_MAX_ARRAY_ELEMENTS)fail(`An array holds 1..${ST_MAX_ARRAY_ELEMENTS} elements`);
    const type=elementType as STType;let initial:STValue=type==='BOOL'?false:0;
    if(accept(':=')){
     if(scope==='input')fail('VAR_INPUT initializers are not supported');
     let sign=1;if(accept('-'))sign=-1;else accept('+');const tok=next(),tu=keyword(tok);
     if(tu==='TRUE'||tu==='FALSE')initial=tu==='TRUE';else if(number.test(tok))initial=sign*Number(tok);else fail(`Expected literal initializer, found ${tok}`);
    }
    requireToken(';');
    if(namedDeclarations.has(key))fail(`Duplicate variable declaration ${name}`);
    namedDeclarations.add(key);arrays.set(key,{name,low,high,type});
    // Elements are scalar cells; element k of name[low..high] is stored as name__(k-low).
    for(let k=0;k<length;k++)declareScalar(`${name}__${k}`,type,scope,initial);
    count++;continue;
   }
   if(structs.has(typeName)){
    next();requireToken(';');namedDeclarations.add(key);structInstances.set(key,typeName);
    for(const f of structs.get(typeName)!.fields)declareScalar(`${name}__${f.name}`,f.type,scope,f.initial);
    count++;continue;
   }
   if(userDefs.get(typeName)?.kind==='block'){
    if(scope!=='local')fail(`${peek()} instances must be declared in a VAR block`);
    const def=userDefs.get(typeName)!;next();requireToken(';');namedDeclarations.add(key);userInstances.set(key,def);
    for(const m of def.members){
     const mapped=memberKey(key,m.name);
     if(typeof m.type==='string'&&isFbType(m.type))declareStd(mapped,m.type);else declareScalar(mapped,m.type as STType,'local',m.initial);
    }
    count++;continue;
   }
   if(isFbType(typeName)){
    if(scope!=='local')fail(`${typeName} instances must be declared in a VAR block`);
    next();requireToken(';');declareStd(key,typeName);
    count++;continue;
   }
   if(!['BOOL','INT','DINT','REAL','LREAL'].includes(typeName))fail(`Unsupported variable type ${peek()}`);
   const type=typeName as STType;next();
   let initial:STValue=type==='BOOL'?false:0;
   if(accept(':=')){
    if(scope==='input')fail('VAR_INPUT initializers are not supported');
    let sign=1;
    if(accept('-'))sign=-1;
    else accept('+');
    const token=next(),upperToken=keyword(token);
    if(upperToken==='TRUE'||upperToken==='FALSE'){
     if(sign<0)fail('Invalid signed BOOL initializer');
     initial=upperToken==='TRUE';
    }else if(number.test(token)){initial=sign*Number(token);}
    else fail(`Expected literal initializer, found ${token}`);
   }
   checkType(type,initial,name);
   requireToken(';');namedDeclarations.add(key);declarations.push({name,type,scope,initial});count++;
  }
  if(!count)fail('Empty variable declaration block');
  requireToken('END_VAR');
 }
 const startsCaseLabel=()=>{
  const here=peek(),nextOne=tokens[pos+1]?.value,nextTwo=tokens[pos+2]?.value;
  return (number.test(here)||here.toUpperCase()==='TRUE'||here.toUpperCase()==='FALSE')&&nextOne===':' ||
    ((here==='-'||here==='+')&&nextOne!==undefined&&number.test(nextOne)&&nextTwo===':');
 };
 function caseLiteral():STValue{
  let sign=1;if(accept('-'))sign=-1;else accept('+');
  const value=next(),up=keyword(value);
  if(up==='TRUE'||up==='FALSE'){if(sign!==1)fail('Signed boolean case label');return up==='TRUE';}
  if(!number.test(value))fail('Expected integer or BOOL case label');
  const literal=Number(value)*sign;
  if(!Number.isSafeInteger(literal))fail('CASE requires integer labels');
  return literal;
 }
 const bodyStart=declarations.length?tokens[pos].offset:0; // Preserve leading comments in untyped programs
 function statements(terminators:ReadonlySet<string>,depth=0,caseBody=false):Statement[]{
  if(depth>16)throw new RangeError('IF nesting limit (16) exceeded');const result:Statement[]=[];
  while(peek()!=='<EOF>'&&!terminators.has(upper())&&!(caseBody&&startsCaseLabel())){
   if(++statementCount>ST_MAX_STATEMENTS_PER_SCAN)throw new RangeError(`Statement limit (${ST_MAX_STATEMENTS_PER_SCAN}) exceeded`);
   // User function calls met while parsing this statement are hoisted to run just before it.
   const mark=result.length,outer=pending;pending=[];
   if(accept('IF')){
    const branches:{when:Expression;body:Statement[]}[]=[];
    const first=expression();requireToken('THEN');branches.push({when:first,body:statements(new Set(['ELSIF','ELSE','END_IF']),depth+1)});
    while(accept('ELSIF')){const when=expression();requireToken('THEN');branches.push({when,body:statements(new Set(['ELSIF','ELSE','END_IF']),depth+1)});}
    const otherwise=accept('ELSE')?statements(new Set(['END_IF']),depth+1):[];
    requireToken('END_IF');requireToken(';');result.push({kind:'if',branches,otherwise});
   }else if(accept('CASE')){
    const selector=expression();requireToken('OF');const arms:{value:STValue;body:Statement[]}[]=[];const seen=new Set<string>();
    while(upper()!=='ELSE'&&upper()!=='END_CASE'&&peek()!=='<EOF>'){
     if(arms.length>=64)throw new RangeError('CASE arm limit (64) exceeded');
     const value=caseLiteral(),key=typeof value+':'+String(value);
     if(seen.has(key))fail('Duplicate CASE label');seen.add(key);requireToken(':');
     arms.push({value,body:statements(new Set(['ELSE','END_CASE']),depth+1,true)});
    }
    if(!arms.length)fail('CASE requires at least one arm');
    const otherwise=accept('ELSE')?statements(new Set(['END_CASE']),depth+1):[];
    requireToken('END_CASE');requireToken(';');result.push({kind:'case',selector,arms,otherwise});
   }else if(accept('WHILE')){
    noHoist=true;let condition:Expression;
    try{condition=expression();}finally{noHoist=false;}
    requireToken('DO');
    const body=statements(new Set(['END_WHILE']),depth+1);
    requireToken('END_WHILE');requireToken(';');
    result.push({kind:'while',condition,body});
   }else if(accept('FOR')){
    const counterName=readName(),counter=keyword(counterName);if(!writes.has(counter))writes.set(counter,counterName);
    requireToken(':=');const from=expression();requireToken('TO');const to=expression();
    const step=accept('BY')?expression():{kind:'literal' as const,value:1};
    requireToken('DO');const body=statements(new Set(['END_FOR']),depth+1);
    requireToken('END_FOR');requireToken(';');result.push({kind:'for',counter,from,to,step,body});
   }else{
    const name=readName();let key=keyword(name),shown=name;
    if(peek()==='('&&userInstances.has(key)){
     // R07 user function block call: inputs are assigned, then the instance's body runs against its own renamed variables.
     const def=userInstances.get(key)!;next();const given=new Set<string>();
     if(peek()!==')'){
      do{
       const param=keyword(readName());
       const member=def.members.find(m=>m.scope==='input'&&keyword(m.name)===param);
       if(!member)fail(`${param} is not an input of ${def.name}`);
       if(given.has(param))fail(`Duplicate argument ${param}`);given.add(param);
       requireToken(':=');result.push(emitAssign(memberKey(key,param),expression()));
      }while(accept(','));
     }
     requireToken(')');requireToken(';');
     result.push(...instantiate(def,key));
    }else if(peek()==='('){
     const instance=key,type=fbInstances.get(instance);
     if(!type)fail(`${name} is not a declared function block instance`);
     next();const args:Record<string,Expression>={};
     if(peek()!==')'){
      do{
       const param=keyword(readName());
       if(!FB_SPEC[type!].inputs.includes(param))fail(`${param} is not an input of ${type}`);
       if(args[param])fail(`Duplicate argument ${param}`);
       requireToken(':=');args[param]=expression();
      }while(accept(','));
     }
     requireToken(')');requireToken(';');result.push({kind:'fb',instance,type:type!,args});
    }else if(peek()==='['){
     const arr=arrays.get(key);if(!arr)fail(`${name} is not an array`);
     next();const index=expression();requireToken(']');
     if(index.kind==='literal'&&(typeof index.value!=='number'||!Number.isSafeInteger(index.value)||index.value<arr!.low||index.value>arr!.high))
      fail(`Array index outside ${arr!.name}[${arr!.low}..${arr!.high}]`);
     requireToken(':=');const expr=expression();requireToken(';');
     for(let k=0;k<arr!.high-arr!.low+1;k++){const cell=`${key}__${k}`;if(!writes.has(cell))writes.set(cell,`${arr!.name}__${k}`);}
     result.push({kind:'assignIndex',name:key,low:arr!.low,high:arr!.high,index,expr});
    }else{
     if(peek()==='.'&&structInstances.has(key)){
      next();const field=next(),def=structs.get(structInstances.get(key)!)!;
      if(!def.fields.some(f=>keyword(f.name)===keyword(field)))fail(`${name}.${field} is not a field of ${structInstances.get(key)}`);
      key=memberKey(key,field);shown=`${name}__${field}`;
     }
     requireToken(':=');const expr=expression();requireToken(';');if(!writes.has(key))writes.set(key,shown);result.push({kind:'assign',name:key,expr});
    }
   }
   if(pending.length)result.splice(mark,0,...pending);
   pending=outer;
  }
  return result;
 }
 const compiled=statements(new Set());
 if(peek()!=='<EOF>')fail(`Unexpected token ${peek()}`);
 if(!compiled.length)throw new SyntaxError('Structured Text requires at least one assignment or IF');
 if(declarations.length){
  const table=new Map(declarations.map(d=>[keyword(d.name),d]));
  for(const [key,name] of reads)if(!table.has(key))fail(`Undeclared variable ${name}`);
  for(const [key,name] of writes){
   const decl=table.get(key);
   if(!decl)throw new SyntaxError(`Undeclared assignment ${name}`);
   if(decl.scope==='input')throw new SyntaxError(`Cannot assign VAR_INPUT ${name}`);
  }
  const validateFor=(body:readonly Statement[]):void=>{for(const stmt of body){
   if(stmt.kind==='for'){
    const type=table.get(stmt.counter)?.type;
    if(type!=='INT'&&type!=='DINT')throw new SyntaxError('FOR counter must be declared INT or DINT');
    validateFor(stmt.body);
   }else if(stmt.kind==='while'){validateFor(stmt.body);}
   else if(stmt.kind==='if'){for(const arm of stmt.branches)validateFor(arm.body);validateFor(stmt.otherwise);}
   else if(stmt.kind==='case'){for(const arm of stmt.arms)validateFor(arm.body);validateFor(stmt.otherwise);}
  }};
  validateFor(compiled);
 }
 const outputs=declarations.length?declarations.filter(d=>d.scope==='output').map(d=>d.name):Array.from(writes.values());
 if(!outputs.length)throw new SyntaxError('Structured Text requires a declared or assigned output');
 return {source,bodySource:source.slice(bodyStart),statements:compiled,referencedInputs:Array.from(reads.entries()).filter(([key])=>!writes.has(key)).map(([,name])=>name),assignedOutputs:outputs,declarations};
}
/** One scan of a standard function block. State lives in the instance's synthetic variables, so it persists in scan memory. */
function stepFunctionBlock(call:Extract<Statement,{kind:'fb'}>,values:Record<string,STValue>,scanMs:number):void{
 const get=(member:string)=>values[fbKey(call.instance,member)];
 const set=(member:string,value:STValue)=>{values[fbKey(call.instance,member)]=value;};
 const flag=(name:string)=>call.args[name]?bool(evaluate(call.args[name],values)):false;
 const int=(name:string)=>{
  const v=call.args[name]?numeric(evaluate(call.args[name],values)):0;
  if(!Number.isFinite(v))throw new RangeError(`${call.type}.${name} must be finite`);return Math.trunc(v);
 };
 const real=(name:string,fallback:number)=>{
  const v=call.args[name]?numeric(evaluate(call.args[name],values)):fallback;
  if(!Number.isFinite(v))throw new RangeError(`${call.type}.${name} must be finite`);return v;
 };
 const clampMs=(n:number)=>Math.max(0,Math.min(2147483647,n));
 switch(call.type){
  case 'TON':{const input=flag('IN'),pt=clampMs(int('PT'));
   const et=input?Math.min(Number(get('ET'))+scanMs,pt):0;set('ET',et);set('Q',input&&et>=pt);break;}
  case 'TOF':{const input=flag('IN'),pt=clampMs(int('PT'));
   if(input){set('Q',true);set('ET',0);}
   else if(get('Q')===true){const et=Math.min(Number(get('ET'))+scanMs,pt);set('ET',et);if(et>=pt)set('Q',false);}
   else set('ET',Math.min(Number(get('ET')),pt));break;}
  case 'TP':{const input=flag('IN'),pt=clampMs(int('PT'));
   if(get('RUN')===true){const et=Math.min(Number(get('ET'))+scanMs,pt);set('ET',et);if(et>=pt){set('RUN',false);set('Q',false);}}
   else{
    if(input&&get('PIN')!==true&&pt>0){set('RUN',true);set('Q',true);set('ET',Math.min(scanMs,pt));if(scanMs>=pt){set('RUN',false);set('Q',false);}}
    else{set('Q',false);if(!input)set('ET',0);}
   }
   set('PIN',input);break;}
  case 'CTU':{const up=flag('CU'),reset=flag('R'),pv=int('PV');let cv=Number(get('CV'));
   if(reset)cv=0;else if(up&&get('PCU')!==true)cv=Math.min(cv+1,32767);
   set('CV',cv);set('Q',cv>=pv);set('PCU',up);break;}
  case 'CTD':{const down=flag('CD'),load=flag('LD'),pv=int('PV');let cv=Number(get('CV'));
   if(load)cv=Math.max(-32768,Math.min(32767,pv));else if(down&&get('PCD')!==true)cv=Math.max(cv-1,-32768);
   set('CV',cv);set('Q',cv<=0);set('PCD',down);break;}
  case 'PID':{
   const dt=scanMs/1000,pv=real('PV',0),sp=real('SP',0),kp=real('KP',0),ki=real('KI',0),kd=real('KD',0),lo=real('OUT_MIN',0),hi=real('OUT_MAX',100);
   if(lo>hi)throw new RangeError('PID.OUT_MIN must not exceed OUT_MAX');
   const e=sp-pv,primed=get('PRIMED')===true,integ=Number(get('INTEG')),perr=Number(get('PERR'));
   const trial=integ+ki*e*dt,d=primed?kd*(e-perr)/dt:0;
   let out=kp*e+trial+d,next=trial;
   if(out>hi){out=hi;if(e>0)next=integ;}else if(out<lo){out=lo;if(e<0)next=integ;}
   set('OUT',out);set('INTEG',next);set('PERR',e);set('PRIMED',true);break;}
  case 'R_TRIG':{const clk=flag('CLK');set('Q',clk&&get('PCLK')!==true);set('PCLK',clk);break;}
  case 'F_TRIG':{const clk=flag('CLK');set('Q',!clk&&get('PCLK')===true);set('PCLK',clk);break;}
 }
}
function numeric(v:STValue):number{if(typeof v!=='number')throw new TypeError('Arithmetic requires numeric operands');return v;}
function bool(v:STValue):boolean{if(typeof v!=='boolean')throw new TypeError('Boolean logic requires BOOL operands');return v;}
function evaluate(expr:Expression,signals:STSignals):STValue{
 if(expr.kind==='literal')return expr.value;
 if(expr.kind==='read'){
  if(!Object.prototype.hasOwnProperty.call(signals,expr.name))throw new Error(`Uninitialized tag ${expr.name}`);
  return signals[expr.name];
 }
 if(expr.kind==='unary'){
  const v=evaluate(expr.inner,signals);return expr.op==='NOT'?!bool(v):expr.op==='-'?-numeric(v):+numeric(v);
 }
 if(expr.kind==='index'){
  const at=numeric(evaluate(expr.index,signals));
  if(!Number.isSafeInteger(at)||at<expr.low||at>expr.high)throw new RangeError(`Array index ${at} outside ${expr.name}[${expr.low}..${expr.high}]`);
  return evaluate({kind:'read',name:`${expr.name}__${at-expr.low}`},signals);
 }
 if(expr.kind==='call'){
  const args=expr.args.map(a=>numeric(evaluate(a,signals)));
  const [a0,a1,a2,a3,a4]=args;
  if((expr.name==='SQRT'&&a0<0)||((expr.name==='LN'||expr.name==='LOG')&&a0<=0))throw new RangeError(`${expr.name} argument out of range`);
  if(expr.name==='SCALE'&&a1===a2)throw new RangeError('SCALE needs different input bounds');
  const result=expr.name==='ABS'?Math.abs(a0):expr.name==='MIN'?Math.min(...args):
    expr.name==='MAX'?Math.max(...args):expr.name==='SQRT'?Math.sqrt(a0):expr.name==='SIN'?Math.sin(a0):
    expr.name==='COS'?Math.cos(a0):expr.name==='TAN'?Math.tan(a0):expr.name==='ATAN'?Math.atan(a0):
    expr.name==='LN'?Math.log(a0):expr.name==='LOG'?Math.log10(a0):expr.name==='EXP'?Math.exp(a0):
    expr.name==='TRUNC'?Math.trunc(a0):expr.name==='SCALE'?a3+(a0-a1)*(a4-a3)/(a2-a1):
    Math.max(a0,Math.min(a1,a2));
  if(expr.name==='LIMIT'&&args[0]>args[2])throw new RangeError('LIMIT requires lower bound <= upper bound');
  if(!Number.isFinite(result))throw new RangeError('Nonfinite ST function result');
  return result;
 }
 const left=evaluate(expr.left,signals);
 // IEC boolean expressions do not have JS side-effect semantics; short-circuit is valid here.
 if(expr.op==='AND')return bool(left)&&bool(evaluate(expr.right,signals));
 if(expr.op==='OR')return bool(left)||bool(evaluate(expr.right,signals));
 const right=evaluate(expr.right,signals);
 let output:STValue;
 switch(expr.op){
  case 'XOR':output=bool(left)!==bool(right);break;
  case '=':output=typeof left===typeof right&&left===right;break;
  case '<>':output=typeof left!==typeof right||left!==right;break;
  case '>':output=numeric(left)>numeric(right);break;
  case '>=':output=numeric(left)>=numeric(right);break;
  case '<':output=numeric(left)<numeric(right);break;
  case '<=':output=numeric(left)<=numeric(right);break;
  case '+':output=numeric(left)+numeric(right);break;
  case '-':output=numeric(left)-numeric(right);break;
  case '*':output=numeric(left)*numeric(right);break;
  case '/':if(numeric(right)===0)throw new RangeError('Division by zero');output=numeric(left)/numeric(right);break;
  case 'MOD':{
   const a=numeric(left),b=numeric(right);
   if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b))throw new TypeError('MOD requires safe integer operands');
   if(b===0)throw new RangeError('Division by zero');
   output=a%b;break;
  }
  default:throw new Error('Unsupported operator');
 }
 if(typeof output==='number'&&!Number.isFinite(output))throw new RangeError('Nonfinite arithmetic result');
 return output;
}
function assertSignals(input:STSignals):void{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length>ST_MAX_DECLARATIONS*2)throw new RangeError(`Signals must be a map of at most ${ST_MAX_DECLARATIONS*2} BOOL/REAL tags`);
 const seen=new Set<string>();
 for(const [k,v] of Object.entries(input)){
  const key=keyword(k);
  if(!identifier.test(k)||RESERVED.has(key)||(typeof v!=='boolean'&&(typeof v!=='number'||!Number.isFinite(v))))throw new TypeError(`Invalid signal: ${k}`);
  if(seen.has(key))throw new TypeError(`Ambiguous signal aliases for ${k}`);
  seen.add(key);
 }
}
/** Each scan starts from last outputs, then samples current inputs; input tags cannot be overwritten. */
/** `scanMs` is the simulated scan period this execution represents (timer function blocks and PID advance by it). */
export function executeStructuredText(program:STProgram,inputs:STSignals,previousOutputs:STSignals={},scanMs:number=ST_SCAN_MS):STResult{
 if(!Number.isSafeInteger(scanMs)||scanMs<1||scanMs>1000)throw new RangeError('Invalid scan period');
 assertSignals(inputs);assertSignals(previousOutputs);
 if(!program||!Array.isArray(program.statements))throw new TypeError('Compile Structured Text before executing');
 // IEC-style tag identifiers ignore case. Typed variables are initialized once,
 // with VAR/VAR_OUTPUT memory passed explicitly between deterministic scans.
 const declarations=program.declarations??[];
 const typed=declarations.length>0;
 const values:Record<string,STValue>=Object.create(null);
 const displays=new Map<string,string>();
 const inputImage=new Map(Object.entries(inputs).map(([tag,value])=>[keyword(tag),value]));
 const priorImage=new Map(Object.entries(previousOutputs).map(([tag,value])=>[keyword(tag),value]));
 if(typed){
  for(const decl of declarations){
   const key=keyword(decl.name);
   const value=decl.scope==='input'?inputImage.get(key):(priorImage.has(key)?priorImage.get(key):decl.initial);
   if(value===undefined)throw new Error(`Missing VAR_INPUT ${decl.name}`);
   checkType(decl.type,value,decl.name);
   values[key]=value;displays.set(key,decl.name);
  }
 }else{
  for(const [tag,value] of Object.entries(previousOutputs)){const key=keyword(tag);values[key]=value;displays.set(key,tag);}
  for(const [tag,value] of Object.entries(inputs)){const key=keyword(tag);values[key]=value;displays.set(key,tag);}
 }
 const inputKeys=new Set(Object.keys(inputs).map(keyword));
 const outputNames=new Map(program.assignedOutputs.map(tag=>[keyword(tag),tag]));
 const declarationTypes=new Map(declarations.map(d=>[keyword(d.name),d]));
 const outputs:Record<string,STValue>={};const assignments:{tag:string;value:STValue}[]=[];
 let operations=0;
 const run=(statements:readonly Statement[],depth:number)=>{
  if(depth>16)throw new RangeError('Execution nesting limit exceeded');
  for(const statement of statements){
   if(++operations>ST_MAX_STATEMENTS_PER_SCAN)throw new RangeError(`Execution statement budget (${ST_MAX_STATEMENTS_PER_SCAN} per scan) exceeded`);
   if(statement.kind==='fb'){
    stepFunctionBlock(statement,values,scanMs);
   }else if(statement.kind==='assign'){
    if(inputKeys.has(statement.name))throw new Error(`Cannot overwrite sampled input ${statement.name}`);
    const value=evaluate(statement.expr,values);
    const declaration=declarationTypes.get(statement.name);
    if(declaration)checkType(declaration.type,value,declaration.name);
    values[statement.name]=value;
    const tag=declaration?.name??outputNames.get(statement.name)??statement.name;
    if(!typed||declaration?.scope==='output')outputs[tag]=value;
    assignments.push({tag,value});
   }else if(statement.kind==='assignIndex'){
    const at=numeric(evaluate(statement.index,values));
    if(!Number.isSafeInteger(at)||at<statement.low||at>statement.high)throw new RangeError(`Array index ${at} outside ${statement.name}[${statement.low}..${statement.high}]`);
    const cell=`${statement.name}__${at-statement.low}`;
    if(inputKeys.has(cell))throw new Error(`Cannot overwrite sampled input ${cell}`);
    const value=evaluate(statement.expr,values);
    const declaration=declarationTypes.get(cell);
    if(declaration)checkType(declaration.type,value,declaration.name);
    values[cell]=value;
    const tag=declaration?.name??cell;
    if(declaration?.scope==='output')outputs[tag]=value;
    assignments.push({tag,value});
   }else if(statement.kind==='if'){
    let body:readonly Statement[]=statement.otherwise;
    for(const branch of statement.branches)if(bool(evaluate(branch.when,values))){body=branch.body;break;}
    run(body,depth+1);
   }else if(statement.kind==='case'){
    const selected=evaluate(statement.selector,values);
    const arm=statement.arms.find(entry=>typeof entry.value===typeof selected&&entry.value===selected);
    run(arm?.body??statement.otherwise,depth+1);
   }else if(statement.kind==='while'){
    let iterations=0;
    while(bool(evaluate(statement.condition,values))){
     if(++iterations>400)throw new RangeError('WHILE iteration budget exceeded (400)');
     run(statement.body,depth+1);
    }
   }else if(statement.kind==='for'){
    if(inputKeys.has(statement.counter))throw new Error('Cannot use input as FOR counter');
    const from=numeric(evaluate(statement.from,values)),to=numeric(evaluate(statement.to,values)),step=numeric(evaluate(statement.step,values));
    if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||!Number.isSafeInteger(step)||step===0)throw new RangeError('FOR bounds and BY must be nonzero safe integers');
    const size=step>0?(to-from)/step:(from-to)/(-step);
    if(size>=400||!Number.isFinite(size))throw new RangeError('FOR exceeds bounded execution budget');
    let iterations=0;
    for(let n=from;step>0?n<=to:n>=to;n+=step){
     if(++iterations>400)throw new RangeError('FOR iteration budget exceeded');
     const declaration=declarationTypes.get(statement.counter);
     if(declaration)checkType(declaration.type,n,declaration.name);
     values[statement.counter]=n;
     run(statement.body,depth+1);
    }
   }
  }
 };
 run(program.statements,0);
 // Preserve state of declared outputs between scans, including unassigned IF branches.
 for(const [key,tag] of outputNames){
  if(Object.prototype.hasOwnProperty.call(values,key)){outputs[tag]=values[key];displays.set(key,tag);}
 }
 const signals=Object.fromEntries(Object.entries(values).map(([key,value])=>[displays.get(key)??key,value]));
 const memory:Record<string,STValue>={};
 if(typed){for(const declaration of declarations)if(declaration.scope!=='input')memory[declaration.name]=values[keyword(declaration.name)];}
 else Object.assign(memory,outputs);
 return {outputs,signals,assignments,memory};
}
export function runStructuredTextScans(program:STProgram,steps:readonly {scans:number;inputs:STSignals}[],initialOutputs:STSignals={}):{rows:{scan:number;inputs:STSignals;outputs:STSignals}[];finalOutputs:STSignals;finalMemory:STSignals}{
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw new RangeError('Provide 1..100 scan steps');
 const total=steps.reduce((n,s)=>n+s.scans,0);if(total>5000)throw new RangeError('Sequence exceeds 5,000 scans');
 const rows:{scan:number;inputs:STSignals;outputs:STSignals}[]=[];let memory:STSignals={...initialOutputs};let lastOutputs:STSignals={};let sampled:Record<string,STValue>={};
 for(const step of steps){if(!Number.isSafeInteger(step.scans)||step.scans<1)throw new RangeError('Invalid scan count');assertSignals(step.inputs);
  // Later scan steps replace earlier case-variant spellings of the same tag.
  for(const tag of Object.keys(step.inputs)){
   const value=step.inputs[tag];
   const former=Object.keys(sampled).find(key=>keyword(key)===keyword(tag));
   if(former!==undefined)delete sampled[former];
   sampled[tag]=value;
  }
  for(let i=0;i<step.scans;i++){const result=executeStructuredText(program,sampled,memory);memory=result.memory;lastOutputs=result.outputs;rows.push({scan:rows.length+1,inputs:{...sampled},outputs:{...result.outputs}});}}
 return {rows,finalOutputs:lastOutputs,finalMemory:memory};
}
export const ST_DEMO=`(* PLC Skills Lab: teaching subset; not a vendor PLC runtime *)
IF NOT EStopOK OR NOT GuardClosed THEN
  Run := FALSE;
ELSIF Stop THEN
  Run := FALSE;
ELSIF Start THEN
  Run := TRUE;
END_IF;
`;
/** Small persistent-memory example; no physical input or certified safety behavior. */
export const ST_TYPED_DEMO=`(* Typed Structured Text training counter *)
VAR_INPUT
 Start : BOOL;
 Stop : BOOL;
END_VAR
VAR_OUTPUT
 Run : BOOL := FALSE;
 Scans : INT := 0;
END_VAR
VAR
 InternalCount : INT := 0;
END_VAR
InternalCount := InternalCount + 1;
Scans := InternalCount;
IF Stop THEN
 Run := FALSE;
ELSIF Start THEN
 Run := TRUE;
END_IF;
`;
