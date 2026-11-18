/** Bounded deterministic teaching subset of IEC 61131-3 Structured Text.
 * This is NOT a vendor parser, real PLC runtime, or safety-rated controller. */
export type STValue=number|boolean;
export type STSignals=Readonly<Record<string,STValue>>;
export type STType='BOOL'|'INT'|'DINT'|'REAL'|'LREAL';
/** Standard function blocks supported as instances: timers, counters and edge detectors (see docs/product/PLC_SUBSET.md). */
export type FbType='TON'|'TOF'|'TP'|'CTU'|'CTD'|'R_TRIG'|'F_TRIG';
/** The engine's fixed scan period; timer function blocks advance by this each scan (the simulator scan is 50 ms). */
export const ST_SCAN_MS=50;
const FB_SPEC:Readonly<Record<FbType,{inputs:readonly string[];outputs:readonly {name:string;type:STType}[];hidden:readonly string[]}>>={
 TON:{inputs:['IN','PT'],outputs:[{name:'Q',type:'BOOL'},{name:'ET',type:'DINT'}],hidden:[]},
 TOF:{inputs:['IN','PT'],outputs:[{name:'Q',type:'BOOL'},{name:'ET',type:'DINT'}],hidden:[]},
 TP:{inputs:['IN','PT'],outputs:[{name:'Q',type:'BOOL'},{name:'ET',type:'DINT'}],hidden:['RUN','PIN']},
 CTU:{inputs:['CU','R','PV'],outputs:[{name:'Q',type:'BOOL'},{name:'CV',type:'INT'}],hidden:['PCU']},
 CTD:{inputs:['CD','LD','PV'],outputs:[{name:'Q',type:'BOOL'},{name:'CV',type:'INT'}],hidden:['PCD']},
 R_TRIG:{inputs:['CLK'],outputs:[{name:'Q',type:'BOOL'}],hidden:['PCLK']},
 F_TRIG:{inputs:['CLK'],outputs:[{name:'Q',type:'BOOL'}],hidden:['PCLK']},
};
const isFbType=(name:string):name is FbType=>Object.prototype.hasOwnProperty.call(FB_SPEC,name);
/** Storage name of an instance member; plain identifiers so it round-trips through the scan memory (collisions are rejected as duplicates). */
const fbKey=(instance:string,member:string)=>`${instance}__${member}`.toUpperCase();
export type STDeclaration={name:string;type:STType;scope:'input'|'output'|'local';initial:STValue};
type Token={value:string;offset:number};
type Expression={kind:'literal';value:STValue}|{kind:'read';name:string}|{kind:'unary';op:string;inner:Expression}|{kind:'binary';op:string;left:Expression;right:Expression}|{kind:'call';name:'ABS'|'MIN'|'MAX'|'LIMIT';args:Expression[]};
type Statement={kind:'assign';name:string;expr:Expression}|{kind:'fb';instance:string;type:FbType;args:Record<string,Expression>}|{kind:'if';branches:{when:Expression;body:Statement[]}[];otherwise:Statement[]}|{kind:'case';selector:Expression;arms:{value:STValue;body:Statement[]}[];otherwise:Statement[]}|{kind:'for';counter:string;from:Expression;to:Expression;step:Expression;body:Statement[]}|{kind:'while';condition:Expression;body:Statement[]};
export type STProgram={source:string;bodySource:string;statements:readonly Statement[];referencedInputs:string[];assignedOutputs:string[];declarations:readonly STDeclaration[]};
export type STResult={outputs:Record<string,STValue>;signals:Record<string,STValue>;assignments:{tag:string;value:STValue}[];memory:Record<string,STValue>};
const keyword=(s:string)=>s.toUpperCase();
const identifier=/^[A-Za-z][A-Za-z0-9_]*$/;
const number=/^(?:\d+(?:\.\d+)?|\.\d+)$/;
const BUILTINS = new Set(['ABS','MIN','MAX','LIMIT']);
const precedence:Readonly<Record<string,number>>={OR:1,XOR:2,AND:3,'=':4,'<>':4,'<':4,'<=':4,'>':4,'>=':4,'+':5,'-':5,'*':6,'/':6,MOD:6};
const RESERVED=new Set(['TON','TOF','TP','CTU','CTD','R_TRIG','F_TRIG','IF','THEN','ELSIF','ELSE','END_IF','AND','OR','XOR','NOT','TRUE','FALSE','MOD','VAR','VAR_INPUT','VAR_OUTPUT','END_VAR','BOOL','INT','DINT','REAL','LREAL','CASE','OF','END_CASE','FOR','TO','BY','DO','END_FOR','WHILE','END_WHILE']);
function tokenize(source:string):Token[]{
 if(typeof source!=='string'||source.length>12000)throw new RangeError('Structured Text must be at most 12,000 characters');
 const tokens:Token[]=[];
 for(let i=0;i<source.length;){
  if(/\s/.test(source[i])){i++;continue;}
  if(source.slice(i,i+2)==='//'){const end=source.indexOf('\n',i+2);i=end<0?source.length:end+1;continue;}
  if(source.slice(i,i+2)==='(*'){const end=source.indexOf('*)',i+2);if(end<0)throw new SyntaxError(`Unterminated comment at ${i}`);i=end+2;continue;}
  const rest=source.slice(i);
  const match=/^(?:[Tt]#(?:\d+(?:\.\d+)?(?:ms|s|m|h))+|(?:\d+(?:\.\d+)?|\.\d+)(?![A-Za-z_])|[A-Za-z][A-Za-z0-9_]*|:=|<=|>=|<>|[=<>+*\/\-();:,.])/.exec(rest);
  if(!match)throw new SyntaxError(`Unexpected character at ${i}: ${source[i]}`);
  tokens.push({value:match[0],offset:i});i+=match[0].length;
  if(tokens.length>3000)throw new RangeError('Structured Text token limit (3,000) exceeded');
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
export function compileStructuredText(source:string):STProgram{
 const tokens=tokenize(source);let pos=0;let statementCount=0;const reads=new Map<string,string>();const writes=new Map<string,string>();const declarations:STDeclaration[]=[];const namedDeclarations=new Set<string>();const fbInstances=new Map<string,FbType>();
 const peek=()=>tokens[pos].value, upper=()=>keyword(peek());
 const next=()=>tokens[pos++].value;
 const fail=(reason:string):never=>{throw new SyntaxError(`${reason} at offset ${tokens[Math.min(pos,tokens.length-1)].offset}`);};
 const accept=(value:string)=>{if(upper()===value){pos++;return true;}return false;};
 const requireToken=(value:string)=>{if(!accept(value))fail(`Expected ${value}, found ${peek()}`);};
 const readName=()=>{const t=peek();if(!identifier.test(t)||RESERVED.has(upper()))fail(`Expected variable name, found ${t}`);pos++;return t;};
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
    do{args.push(expression(1,depth+1));if(args.length>4)fail('Too many function arguments');}
    while(accept(','));
   }
   requireToken(')');
   if((u==='ABS'&&args.length!==1)||(u==='LIMIT'&&args.length!==3)||
      ((u==='MIN'||u==='MAX')&&(args.length<2||args.length>4)))
     fail('Unsupported function arity '+u);
   left={kind:'call',name:u as 'ABS'|'MIN'|'MAX'|'LIMIT',args};
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
 while(['VAR','VAR_INPUT','VAR_OUTPUT'].includes(upper())){
  const header=keyword(next());const scope:STDeclaration['scope']=header==='VAR_INPUT'?'input':header==='VAR_OUTPUT'?'output':'local';
  let count=0;
  while(upper()!=='END_VAR'){
   if(peek()==='<EOF>')fail('Unterminated variable declaration block');
   if(declarations.length>=128)throw new RangeError('Structured Text declaration limit (128) exceeded');
   const name=readName(),key=keyword(name);
   if(namedDeclarations.has(key))fail(`Duplicate variable declaration ${name}`);
   requireToken(':');
   const typeName=upper();
   if(isFbType(typeName)){
    if(scope!=='local')fail(`${typeName} instances must be declared in a VAR block`);
    next();requireToken(';');namedDeclarations.add(key);fbInstances.set(key,typeName);
    // The synthetic storage variables reserve their names so a user variable can never alias an instance's state.
    for(const o of FB_SPEC[typeName].outputs){const n=fbKey(key,o.name);namedDeclarations.add(n);declarations.push({name:n,type:o.type,scope:'local',initial:o.type==='BOOL'?false:0});}
    for(const h of FB_SPEC[typeName].hidden){const n=fbKey(key,h);namedDeclarations.add(n);declarations.push({name:n,type:'BOOL',scope:'local',initial:false});}
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
   if(++statementCount>200)throw new RangeError('Statement limit (200) exceeded');
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
    const condition=expression();requireToken('DO');
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
    const name=readName();
    if(peek()==='('){
     const instance=keyword(name),type=fbInstances.get(instance);
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
     requireToken(')');requireToken(';');result.push({kind:'fb',instance,type:type!,args});continue;
    }
    requireToken(':=');const expr=expression();requireToken(';');const key=keyword(name);if(!writes.has(key))writes.set(key,name);result.push({kind:'assign',name:key,expr});
   }
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
function stepFunctionBlock(call:Extract<Statement,{kind:'fb'}>,values:Record<string,STValue>):void{
 const get=(member:string)=>values[fbKey(call.instance,member)];
 const set=(member:string,value:STValue)=>{values[fbKey(call.instance,member)]=value;};
 const flag=(name:string)=>call.args[name]?bool(evaluate(call.args[name],values)):false;
 const int=(name:string)=>{
  const v=call.args[name]?numeric(evaluate(call.args[name],values)):0;
  if(!Number.isFinite(v))throw new RangeError(`${call.type}.${name} must be finite`);return Math.trunc(v);
 };
 const clampMs=(n:number)=>Math.max(0,Math.min(2147483647,n));
 switch(call.type){
  case 'TON':{const input=flag('IN'),pt=clampMs(int('PT'));
   const et=input?Math.min(Number(get('ET'))+ST_SCAN_MS,pt):0;set('ET',et);set('Q',input&&et>=pt);break;}
  case 'TOF':{const input=flag('IN'),pt=clampMs(int('PT'));
   if(input){set('Q',true);set('ET',0);}
   else if(get('Q')===true){const et=Math.min(Number(get('ET'))+ST_SCAN_MS,pt);set('ET',et);if(et>=pt)set('Q',false);}
   else set('ET',Math.min(Number(get('ET')),pt));break;}
  case 'TP':{const input=flag('IN'),pt=clampMs(int('PT'));
   if(get('RUN')===true){const et=Math.min(Number(get('ET'))+ST_SCAN_MS,pt);set('ET',et);if(et>=pt){set('RUN',false);set('Q',false);}}
   else{
    if(input&&get('PIN')!==true&&pt>0){set('RUN',true);set('Q',true);set('ET',Math.min(ST_SCAN_MS,pt));if(ST_SCAN_MS>=pt){set('RUN',false);set('Q',false);}}
    else{set('Q',false);if(!input)set('ET',0);}
   }
   set('PIN',input);break;}
  case 'CTU':{const up=flag('CU'),reset=flag('R'),pv=int('PV');let cv=Number(get('CV'));
   if(reset)cv=0;else if(up&&get('PCU')!==true)cv=Math.min(cv+1,32767);
   set('CV',cv);set('Q',cv>=pv);set('PCU',up);break;}
  case 'CTD':{const down=flag('CD'),load=flag('LD'),pv=int('PV');let cv=Number(get('CV'));
   if(load)cv=Math.max(-32768,Math.min(32767,pv));else if(down&&get('PCD')!==true)cv=Math.max(cv-1,-32768);
   set('CV',cv);set('Q',cv<=0);set('PCD',down);break;}
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
 if(expr.kind==='call'){
  const args=expr.args.map(a=>numeric(evaluate(a,signals)));
  const result=expr.name==='ABS'?Math.abs(args[0]):expr.name==='MIN'?Math.min(...args):
    expr.name==='MAX'?Math.max(...args):Math.max(args[0],Math.min(args[1],args[2]));
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
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length>128)throw new RangeError('Signals must be a map of at most 128 BOOL/REAL tags');
 const seen=new Set<string>();
 for(const [k,v] of Object.entries(input)){
  const key=keyword(k);
  if(!identifier.test(k)||RESERVED.has(key)||(typeof v!=='boolean'&&(typeof v!=='number'||!Number.isFinite(v))))throw new TypeError(`Invalid signal: ${k}`);
  if(seen.has(key))throw new TypeError(`Ambiguous signal aliases for ${k}`);
  seen.add(key);
 }
}
/** Each scan starts from last outputs, then samples current inputs; input tags cannot be overwritten. */
export function executeStructuredText(program:STProgram,inputs:STSignals,previousOutputs:STSignals={}):STResult{
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
   if(++operations>400)throw new RangeError('Execution statement budget exceeded');
   if(statement.kind==='fb'){
    stepFunctionBlock(statement,values);
   }else if(statement.kind==='assign'){
    if(inputKeys.has(statement.name))throw new Error(`Cannot overwrite sampled input ${statement.name}`);
    const value=evaluate(statement.expr,values);
    const declaration=declarationTypes.get(statement.name);
    if(declaration)checkType(declaration.type,value,declaration.name);
    values[statement.name]=value;
    const tag=declaration?.name??outputNames.get(statement.name)??statement.name;
    if(!typed||declaration?.scope==='output')outputs[tag]=value;
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
