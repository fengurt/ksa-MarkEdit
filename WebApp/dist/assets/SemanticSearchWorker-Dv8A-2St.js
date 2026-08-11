(function(){"use strict";var em=class{constructor(e){this.trie=this._build_trie(e)}_build_trie(e){const t=Object.create(null);for(const r of e){let i=t;for(let n=0;n<r.length;++n){const a=r[n];i=i[a]??=Object.create(null)}i.end=r}return t}split(e){const t=[],r=e.length;let i=0,n=0;for(;n<r;){let a=this.trie,s=null,u=n;for(;u<r&&(a=a[e[u]]);)a.end&&(s=a.end),++u;s?(n>i&&t.push(e.slice(i,n)),t.push(s),n+=s.length,i=n):++n}return i<r&&t.push(e.slice(i)),t}},Ta=em,tm=class{constructor(e){this.content=e.content,this.id=e.id,this.single_word=e.single_word??!1,this.lstrip=e.lstrip??!1,this.rstrip=e.rstrip??!1,this.special=e.special??!1,this.normalized=e.normalized??!this.special}},rm=tm,za=(()=>{const e=[...Array.from({length:94},(n,a)=>a+33),...Array.from({length:12},(n,a)=>a+161),...Array.from({length:82},(n,a)=>a+174)],t=e.slice();let r=0;for(let n=0;n<256;++n)e.includes(n)||(e.push(n),t.push(256+r),r+=1);const i=t.map(n=>String.fromCharCode(n));return Object.fromEntries(e.map((n,a)=>[n,i[a]]))})(),im=e=>Object.fromEntries(Object.entries(e).map(([t,r])=>[r,t])),nm=im(za),Ea=".,!?…。，、।۔،",am=new Map([["(?i:'s|'t|'re|'ve|'m|'ll|'d)","(?:'([sS]|[tT]|[rR][eE]|[vV][eE]|[mM]|[lL][lL]|[dD]))"],["(?i:[sdmt]|ll|ve|re)","(?:[sS]|[dD]|[mM]|[tT]|[lL][lL]|[vV][eE]|[rR][eE])"],["[^\\r\\n\\p{L}\\p{N}]?+","[^\\r\\n\\p{L}\\p{N}]?"],["[^\\s\\p{L}\\p{N}]++","[^\\s\\p{L}\\p{N}]+"],["(?>\\p{Nd}{510})","(?:\\p{Nd}{510})"],["\\p{Nd}{3}+","(?:\\p{Nd}{3})+"],["\\G",""],[` ?[^(\\s|[${Ea}])]+`,` ?[^\\s${Ea}]+`]]),vr="\\p{P}\\u0021-\\u002F\\u003A-\\u0040\\u005B-\\u0060\\u007B-\\u007E",di=e=>e.replace(/ \./g,".").replace(/ \?/g,"?").replace(/ \!/g,"!").replace(/ ,/g,",").replace(/ \' /g,"'").replace(/ n't/g,"n't").replace(/ 'm/g,"'m").replace(/ 's/g,"'s").replace(/ 've/g,"'ve").replace(/ 're/g,"'re"),xr=(e,t=!0)=>{if(e.Regex!==void 0){let r=e.Regex.replace(/\\([#&~])/g,"$1");r=r.replace(/\\A/g,"^").replace(/\\z/g,"$").replace(/\\Z/g,"(?=\\r?\\n?$)");for(const[i,n]of am)r=r.replaceAll(i,n);try{return new RegExp(r,"gu")}catch(i){if(!(i instanceof SyntaxError)||!i.message.toLowerCase().includes("invalid property name"))throw i;let n=!1;const a=r.replace(/(\\[pP])\{([^}=]+)\}/g,(s,u,l)=>{try{return new RegExp(`\\p{${l}}`,"u"),`${u}{${l}}`}catch{return n=!0,`${u}{Script=${l}}`}});if(!n)throw i;try{return new RegExp(a,"gu")}catch{throw i}}}else if(e.String!==void 0){const r=sm(e.String);return new RegExp(t?r:`(${r})`,"gu")}else return console.warn("Unknown pattern type:",e),null},sm=e=>e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),om=(e,t,r)=>{const i=[];let n=0;for(;n<e.length;){if(i.push(e[n]),(t.get(e[n])??r)!==r){++n;continue}for(;++n<e.length&&(t.get(e[n])??r)===r;)t.get(i.at(-1))!==r&&(i[i.length-1]+=e[n])}return i},um=e=>e>=19968&&e<=40959||e>=13312&&e<=19903||e>=131072&&e<=173791||e>=173824&&e<=177983||e>=177984&&e<=178207||e>=178208&&e<=183983||e>=63744&&e<=64255||e>=194560&&e<=195103,lm=e=>Number.isInteger(e)||typeof e=="bigint",dm=e=>{let t=0;for(const r of e)++t;return t},pm=e=>Ia(e.toLowerCase()),We=(...e)=>Array.prototype.concat.apply([],e),pi=e=>new Map(Object.entries(e)),cm=(e,t)=>{const r=[];let i=0;for(const n of e.matchAll(t)){const a=n[0];i<n.index&&r.push(e.slice(i,n.index)),a.length>0&&r.push(a),i=n.index+a.length}return i<e.length&&r.push(e.slice(i)),r},Ia=e=>e.replace(new RegExp("\\p{M}","gu"),""),Ca=(e,t,r=[])=>{if(!e||Array.isArray(e)||typeof e!="object")return`${t} must be a valid object`;for(const i of r)if(!(i in e))return`${t} must contain a "${i}" property`;return null},hm=e=>e.match(/\S+/g)||[],fm=class{constructor(){const e=function(...t){return e._call(...t)};return Object.setPrototypeOf(e,new.target.prototype)}},Yt=fm,mm=class extends Yt{constructor(e){super(),this.config=e}_call(e){return this.normalize(e)}},at=mm,gm=class extends at{tokenize_chinese_chars(e){const t=[];for(let r=0;r<e.length;++r){const i=e[r],n=i.charCodeAt(0);um(n)?(t.push(" "),t.push(i),t.push(" ")):t.push(i)}return t.join("")}strip_accents(e){return e.normalize("NFD").replace(new RegExp("\\p{Mn}","gu"),"")}is_control(e){switch(e){case"	":case`
`:case"\r":return!1;default:return new RegExp("^\\p{Cc}|\\p{Cf}|\\p{Co}|\\p{Cs}$","u").test(e)}}clean_text(e){const t=[];for(const r of e){const i=r.charCodeAt(0);i===0||i===65533||this.is_control(r)||(/^\s$/.test(r)?t.push(" "):t.push(r))}return t.join("")}normalize(e){return this.config.clean_text&&(e=this.clean_text(e)),this.config.handle_chinese_chars&&(e=this.tokenize_chinese_chars(e)),this.config.lowercase?(e=e.toLowerCase(),this.config.strip_accents!==!1&&(e=this.strip_accents(e))):this.config.strip_accents&&(e=this.strip_accents(e)),e}},_m=gm,ym=class extends at{constructor(e){super(e),this.charsmap=e.precompiled_charsmap??null}normalize(e){return e=e.replace(/[\u0001-\u0008\u000B\u000E-\u001F\u007F\u008F\u009F]/gm,""),e=e.replace(/[\u0009\u000A\u000C\u000D\u00A0\u1680\u2000-\u200F\u2028\u2029\u202F\u205F\u2581\u3000\uFEFF\uFFFD]/gm," "),e.includes("～")?e=e.split("～").map(r=>r.normalize("NFKC")).join("～"):e=e.normalize("NFKC"),e}},bm=ym,wm=class extends at{constructor(e){super(e),this.normalizers=(e.normalizers??[]).map(t=>Aa(t))}normalize(e){return this.normalizers.reduce((t,r)=>r?r.normalize(t):t,e)}},$m=wm,vm=class extends at{normalize(e){const t=xr(this.config.pattern??{});return t===null?e:e.replaceAll(t,this.config.content??"")}},xm=vm,km=class extends at{constructor(){super(...arguments),this.form="NFC"}normalize(e){return e=e.normalize(this.form),e}},kr=km,Sm=class extends kr{constructor(){super(...arguments),this.form="NFC"}},Tm=Sm,zm=class extends kr{constructor(){super(...arguments),this.form="NFD"}},Em=zm,Im=class extends kr{constructor(){super(...arguments),this.form="NFKC"}},Cm=Im,Am=class extends kr{constructor(){super(...arguments),this.form="NFKD"}},Om=Am,Rm=class extends at{normalize(e){return this.config.strip_left&&this.config.strip_right?e=e.trim():(this.config.strip_left&&(e=e.trimStart()),this.config.strip_right&&(e=e.trimEnd())),e}},Bm=Rm,Nm=class extends at{normalize(e){return Ia(e)}},Mm=Nm,Dm=class extends at{normalize(e){return e.toLowerCase()}},Pm=Dm,Um=class extends at{normalize(e){return e=this.config.prepend+e,e}},qm=Um;function Lm(e){if(e===null)return null;switch(e.type){case"BertNormalizer":return new _m(e);case"Precompiled":return new bm(e);case"Sequence":return new $m(e);case"Replace":return new xm(e);case"NFC":return new Tm(e);case"NFD":return new Em(e);case"NFKC":return new Cm(e);case"NFKD":return new Om(e);case"Strip":return new Bm(e);case"StripAccents":return new Mm(e);case"Lowercase":return new Pm(e);case"Prepend":return new qm(e);default:throw new Error(`Unknown Normalizer type: ${e.type}`)}}var Aa=Lm,Wm=class extends Yt{pre_tokenize(e,t){return(Array.isArray(e)?e.map(r=>this.pre_tokenize_text(r,t)):this.pre_tokenize_text(e,t)).flat()}_call(e,t){return this.pre_tokenize(e,t)}},Ve=Wm,Vm=class extends Ve{constructor(e){super(),this.config=e,this.add_prefix_space=this.config.add_prefix_space??!1,this.trim_offsets=this.config.trim_offsets??!1,this.use_regex=this.config.use_regex??!0,this.pattern=new RegExp("'s|'t|'re|'ve|'m|'ll|'d| ?\\p{L}+| ?\\p{N}+| ?[^\\s\\p{L}\\p{N}]+|\\s+(?!\\S)|\\s+","gu"),this.byte_encoder=za,this.text_encoder=new TextEncoder}pre_tokenize_text(e,t){return this.add_prefix_space&&!e.startsWith(" ")&&(e=" "+e),(this.use_regex?e.match(this.pattern)||[]:[e]).map(i=>Array.from(this.text_encoder.encode(i),n=>this.byte_encoder[n]).join(""))}},Gm=Vm,Fm=class extends Ve{pre_tokenize_text(e,t){return e.match(/\w+|[^\w\s]+/g)||[]}},Hm=Fm,jm=class extends Ve{constructor(e){super(),this.replacement=e.replacement??"▁",this.str_rep=e.str_rep||this.replacement,this.prepend_scheme=e.prepend_scheme??"always"}pre_tokenize_text(e,t){const{section_index:r=void 0}=t??{};let i=e.replaceAll(" ",this.str_rep);return!i.startsWith(this.replacement)&&(this.prepend_scheme==="always"||this.prepend_scheme==="first"&&r===0)&&(i=this.str_rep+i),[i]}},Km=jm,Zm=class extends Ve{constructor(e){super(),this.config=e,this.pattern=xr(this.config.pattern??{},this.config.invert??!0)}pre_tokenize_text(e){return this.pattern===null?[]:this.config.invert?e.match(this.pattern)||[]:this.config.behavior?.toLowerCase()==="removed"?e.split(this.pattern).filter(t=>t):cm(e,this.pattern)}},Xm=Zm,Qm=class extends Ve{constructor(e){super(),this.config=e,this.pattern=new RegExp(`[^${vr}]+|[${vr}]+`,"gu")}pre_tokenize_text(e){return e.match(this.pattern)||[]}},Ym=Qm,Jm=class extends Ve{constructor(e){super(),this.config=e;const t=`[^\\d]+|\\d${this.config.individual_digits?"":"+"}`;this.pattern=new RegExp(t,"gu")}pre_tokenize_text(e){return e.match(this.pattern)||[]}},eg=Jm,tg=class extends Ve{constructor(){super(),this.pattern=new RegExp(`[^\\s${vr}]+|[${vr}]`,"gu")}pre_tokenize_text(e,t){return e.trim().match(this.pattern)||[]}},rg=tg,ig=class extends Ve{constructor(e){super(),this.config=e,this.pattern=xr(this.config.pattern??{}),this.content=this.config.content??""}pre_tokenize_text(e){return this.pattern===null?[e]:[e.replaceAll(this.pattern,this.config.content??"")]}},ng=ig,ag=class extends Ve{constructor(e){super(),this.tokenizers=(e.pretokenizers??[]).map(t=>Oa(t))}pre_tokenize_text(e,t){return this.tokenizers.reduce((r,i)=>i?i.pre_tokenize(r,t):r,[e])}},sg=ag,og=class extends Ve{pre_tokenize_text(e){return hm(e)}},ug=og,lg=class extends Ve{constructor(e){super(),this.config=e,this._length=e.length}pre_tokenize_text(e){const t=[];for(let r=0;r<e.length;r+=this._length)t.push(e.slice(r,r+this._length));return t}},dg=lg;function pg(e){if(e===null)return null;switch(e.type){case"BertPreTokenizer":return new rg;case"Sequence":return new sg(e);case"Whitespace":return new Hm;case"WhitespaceSplit":return new ug;case"Metaspace":return new Km(e);case"ByteLevel":return new Gm(e);case"Split":return new Xm(e);case"Punctuation":return new Ym(e);case"Digits":return new eg(e);case"Replace":return new ng(e);case"FixedLength":return new dg(e);default:throw new Error(`Unknown PreTokenizer type: ${e.type}`)}}var Oa=pg,cg=class extends Yt{constructor(e){super(),this.config=e,this.vocab=[],this.tokens_to_ids=new Map,this.unk_token_id=void 0,this.unk_token=void 0,this.end_of_word_suffix=void 0,this.fuse_unk=this.config.fuse_unk??!1}_call(e){let t=this.encode(e);return this.fuse_unk&&(t=om(t,this.tokens_to_ids,this.unk_token_id)),t}},Sr=cg,hg=class extends Sr{constructor(e){super(e),this.max_input_chars_per_word=100,this.tokens_to_ids=pi(e.vocab),this.unk_token_id=this.tokens_to_ids.get(e.unk_token),this.unk_token=e.unk_token,this.max_input_chars_per_word=e.max_input_chars_per_word??100,this.vocab=new Array(this.tokens_to_ids.size);for(const[t,r]of this.tokens_to_ids)this.vocab[r]=t}encode(e){const t=[];for(const r of e){const i=[...r];if(i.length>this.max_input_chars_per_word){t.push(this.unk_token);continue}let n=!1,a=0;const s=[];for(;a<i.length;){let u=i.length,l=null;for(;a<u;){let d=i.slice(a,u).join("");if(a>0&&(d=this.config.continuing_subword_prefix+d),this.tokens_to_ids.has(d)){l=d;break}--u}if(l===null){n=!0;break}s.push(l),a=u}n?t.push(this.unk_token):t.push(...s)}return t}},Ra=hg,Ba=class Xf{constructor(t,r){this.is_leaf=t,this.children=r}static default(){return new Xf(!1,new Map)}},fg=class{constructor(){this.root=Ba.default()}extend(e){for(const t of e)this.push(t)}push(e){let t=this.root;for(const r of e){let i=t.children.get(r);i===void 0&&(i=Ba.default(),t.children.set(r,i)),t=i}t.is_leaf=!0}*common_prefix_search(e){let t=this.root;if(t===void 0)return;let r="";for(const i of e){if(r+=i,t=t.children.get(i),t===void 0)return;t.is_leaf&&(yield r)}}},mg=fg,ci=class Qf{constructor(t,r,i,n,a){this.token_id=t,this.node_id=r,this.pos=i,this.length=n,this.score=a,this.prev=null,this.backtrace_score=0}clone(){const t=new Qf(this.token_id,this.node_id,this.pos,this.length,this.score);return t.prev=this.prev,t.backtrace_score=this.backtrace_score,t}},gg=class{constructor(e,t,r){this.chars=Array.from(e),this.len=this.chars.length,this.bos_token_id=t,this.eos_token_id=r,this.nodes=[],this.begin_nodes=Array.from({length:this.len+1},()=>[]),this.end_nodes=Array.from({length:this.len+1},()=>[]);const i=new ci(this.bos_token_id??0,0,0,0,0),n=new ci(this.eos_token_id??0,1,this.len,0,0);this.nodes.push(i.clone()),this.nodes.push(n.clone()),this.begin_nodes[this.len].push(n),this.end_nodes[0].push(i)}insert(e,t,r,i){const n=this.nodes.length,a=new ci(i,n,e,t,r);this.begin_nodes[e].push(a),this.end_nodes[e+t].push(a),this.nodes.push(a)}viterbi(){const e=this.len;let t=0;for(;t<=e;){if(this.begin_nodes[t].length==0)return[];for(let s of this.begin_nodes[t]){s.prev=null;let u=0,l=null;for(let d of this.end_nodes[t]){const c=d.backtrace_score+s.score;(l===null||c>u)&&(l=d.clone(),u=c)}if(l!==null)s.prev=l,s.backtrace_score=u;else return[]}++t}const r=[],n=this.begin_nodes[e][0].prev;if(n===null)return[];let a=n.clone();for(;a.prev!==null;)r.push(a.clone()),a=a.clone().prev.clone();return r.reverse(),r}piece(e){return this.chars.slice(e.pos,e.pos+e.length).join("")}tokens(){return this.viterbi().map(t=>this.piece(t))}token_ids(){return this.viterbi().map(t=>t.token_id)}},_g=gg;function yg(e){if(e.length===0)throw new Error("Array must not be empty");let t=e[0],r=0;for(let i=1;i<e.length;++i)e[i]<t&&(t=e[i],r=i);return[t,r]}var bg=class extends Sr{constructor(e,t){super(e);const r=e.vocab.length;this.vocab=new Array(r),this.scores=new Array(r);for(let i=0;i<r;++i)[this.vocab[i],this.scores[i]]=e.vocab[i];this.unk_token_id=e.unk_id,this.unk_token=this.vocab[e.unk_id],this.tokens_to_ids=new Map(this.vocab.map((i,n)=>[i,n])),this.bos_token=" ",this.bos_token_id=this.tokens_to_ids.get(this.bos_token),this.eos_token=t,this.eos_token_id=this.tokens_to_ids.get(this.eos_token),this.unk_token=this.vocab[this.unk_token_id],this.min_score=yg(this.scores)[0],this.unk_score=this.min_score-10,this.scores[this.unk_token_id]=this.unk_score,this.trie=new mg,this.trie.extend(this.vocab),this.fuse_unk=!0}populate_nodes(e){const t=e.chars,r=1;let i=0;for(;i<t.length;){let n=!1;const a=t.slice(i).join(""),s=this.trie.common_prefix_search(a);for(const u of s){const l=this.tokens_to_ids.get(u),d=this.scores[l],c=dm(u);e.insert(i,c,d,l),!n&&c===r&&(n=!0)}n||e.insert(i,r,this.unk_score,this.unk_token_id),i+=r}}tokenize(e){const t=new _g(e,this.bos_token_id,this.eos_token_id);return this.populate_nodes(t),t.tokens()}encode(e){const t=[];for(const r of e){const i=this.tokenize(r);t.push(...i)}return t}},Na=bg,wg=class{constructor(e=(r,i)=>r>i,t=1/0){this._heap=[],this._comparator=e,this._max_size=t}get size(){return this._heap.length}is_empty(){return this.size===0}peek(){return this._heap[0]}push(...e){return this.extend(e)}extend(e){for(const t of e)if(this.size<this._max_size)this._heap.push(t),this._sift_up();else{const r=this._smallest();this._comparator(t,this._heap[r])&&(this._heap[r]=t,this._sift_up_from(r))}return this.size}pop(){const e=this.peek(),t=this.size-1;return t>0&&this._swap(0,t),this._heap.pop(),this._sift_down(),e}replace(e){const t=this.peek();return this._heap[0]=e,this._sift_down(),t}_parent(e){return(e+1>>>1)-1}_left(e){return(e<<1)+1}_right(e){return e+1<<1}_greater(e,t){return this._comparator(this._heap[e],this._heap[t])}_swap(e,t){const r=this._heap[e];this._heap[e]=this._heap[t],this._heap[t]=r}_sift_up(){this._sift_up_from(this.size-1)}_sift_up_from(e){for(;e>0&&this._greater(e,this._parent(e));)this._swap(e,this._parent(e)),e=this._parent(e)}_sift_down(){let e=0;for(;this._left(e)<this.size&&this._greater(this._left(e),e)||this._right(e)<this.size&&this._greater(this._right(e),e);){const t=this._right(e)<this.size&&this._greater(this._right(e),this._left(e))?this._right(e):this._left(e);this._swap(e,t),e=t}}_smallest(){return 2**Math.floor(Math.log2(this.size))-1}},$g=wg,vg=class{constructor(e){this.capacity=e,this.cache=new Map}get(e){if(!this.cache.has(e))return;const t=this.cache.get(e);return this.cache.delete(e),this.cache.set(e,t),t}put(e,t){this.cache.has(e)&&this.cache.delete(e),this.cache.set(e,t),this.cache.size>this.capacity&&this.cache.delete(this.cache.keys().next().value)}clear(){this.cache.clear()}},xg=vg,kg=class extends Sr{constructor(e){super(e),this.tokens_to_ids=pi(e.vocab),this.unk_token_id=this.tokens_to_ids.get(e.unk_token),this.unk_token=e.unk_token,this.vocab=new Array(this.tokens_to_ids.size);for(const[r,i]of this.tokens_to_ids)this.vocab[i]=r;const t=Array.isArray(e.merges[0]);this.merges=t?e.merges:e.merges.map(r=>r.split(" ",2)),this.bpe_ranks=new Map(this.merges.map((r,i)=>[JSON.stringify(r),i])),this.end_of_word_suffix=e.end_of_word_suffix,this.continuing_subword_suffix=e.continuing_subword_suffix??null,this.byte_fallback=this.config.byte_fallback??!1,this.byte_fallback&&(this.text_encoder=new TextEncoder),this.ignore_merges=this.config.ignore_merges??!1,this.max_length_to_cache=256,this.cache_capacity=1e4,this.cache=new xg(this.cache_capacity)}clear_cache(){this.cache.clear()}bpe(e){if(e.length===0)return[];const t=this.cache.get(e);if(t!==void 0)return t;const r=Array.from(e);this.end_of_word_suffix&&(r[r.length-1]+=this.end_of_word_suffix);let i=[];if(r.length>1){const n=new $g((u,l)=>u.score<l.score);let a={token:r[0],bias:0,prev:null,next:null},s=a;for(let u=1;u<r.length;++u){const l={bias:u/r.length,token:r[u],prev:s,next:null};s.next=l,this.add_node(n,s),s=l}for(;!n.is_empty();){const u=n.pop();if(u.deleted||!u.next||u.next.deleted)continue;if(u.deleted=!0,u.next.deleted=!0,u.prev){const d={...u.prev};u.prev.deleted=!0,u.prev=d,d.prev?d.prev.next=d:a=d}const l={token:u.token+u.next.token,bias:u.bias,prev:u.prev,next:u.next.next};l.prev?(l.prev.next=l,this.add_node(n,l.prev)):a=l,l.next&&(l.next.prev=l,this.add_node(n,l))}for(let u=a;u!==null;u=u.next)i.push(u.token)}else i=r;if(this.continuing_subword_suffix)for(let n=0;n<i.length-1;++n)i[n]+=this.continuing_subword_suffix;return e.length<this.max_length_to_cache&&this.cache.put(e,i),i}add_node(e,t){const r=this.bpe_ranks.get(JSON.stringify([t.token,t.next.token]));r!==void 0&&(t.score=r+t.bias,e.push(t))}encode(e){const t=[];for(const r of e){if(this.ignore_merges&&this.tokens_to_ids.has(r)){t.push(r);continue}const i=this.bpe(r);for(const n of i)if(this.tokens_to_ids.has(n))t.push(n);else if(this.byte_fallback){const a=Array.from(this.text_encoder.encode(n)).map(s=>`<0x${s.toString(16).toUpperCase().padStart(2,"0")}>`);a.every(s=>this.tokens_to_ids.has(s))?t.push(...a):this.unk_token!=null&&t.push(this.unk_token)}else this.unk_token!=null&&t.push(this.unk_token)}return t}},Ma=kg,Sg=class extends Sr{constructor(e,t){super(e);const r=e.vocab;this.tokens_to_ids=pi(t.target_lang?r[t.target_lang]:r),this.bos_token=t.bos_token,this.bos_token_id=this.tokens_to_ids.get(this.bos_token),this.eos_token=t.eos_token,this.eos_token_id=this.tokens_to_ids.get(this.eos_token),this.pad_token=t.pad_token,this.pad_token_id=this.tokens_to_ids.get(this.pad_token),this.unk_token=t.unk_token,this.unk_token_id=this.tokens_to_ids.get(this.unk_token),this.vocab=new Array(this.tokens_to_ids.size);for(const[i,n]of this.tokens_to_ids)this.vocab[n]=i}encode(e){return e}},Tg=Sg;function zg(e,t){switch(e.type){case"WordPiece":return new Ra(e);case"Unigram":return new Na(e,t.eos_token);case"BPE":return new Ma(e);default:if(e.vocab)return Array.isArray(e.vocab)?new Na(e,t.eos_token):Object.hasOwn(e,"continuing_subword_prefix")&&Object.hasOwn(e,"unk_token")?Object.hasOwn(e,"merges")?new Ma(e):new Ra(e):new Tg(e,{target_lang:t.target_lang,bos_token:t.bos_token,eos_token:t.eos_token,pad_token:t.pad_token,unk_token:t.unk_token});throw new Error(`Unknown TokenizerModel type: ${e?.type}`)}}var Eg=zg,Ig=class extends Yt{constructor(e){super(),this.config=e}_call(e,...t){return this.post_process(e,...t)}},Jt=Ig,Cg=class extends Jt{post_process(e,t=null,r=!0){const i=t===null?this.config.single:this.config.pair;let n=[],a=[];for(const s of i)"SpecialToken"in s?r&&(n.push(s.SpecialToken.id),a.push(s.SpecialToken.type_id)):"Sequence"in s&&(s.Sequence.id==="A"?(n=We(n,e),a=We(a,new Array(e.length).fill(s.Sequence.type_id))):s.Sequence.id==="B"&&(n=We(n,t),a=We(a,new Array(t.length).fill(s.Sequence.type_id))));return{tokens:n,token_type_ids:a}}},Ag=Cg,Og=class extends Jt{post_process(e,t=null){return{tokens:e,tokens_pair:t}}},Rg=Og,Bg=class extends Jt{constructor(e){super(e),this.sep=e.sep,this.cls=e.cls}post_process(e,t=null,r=!0){r&&(e=We([this.cls[0]],e,[this.sep[0]]));let i=new Array(e.length).fill(0);if(t){const n=[],a=r?[this.sep[0]]:[];e=We(e,n,t,a),i=We(i,new Array(t.length+n.length+a.length).fill(1))}return{tokens:e,token_type_ids:i}}},Ng=Bg,Mg=class extends Jt{constructor(e){super(e),this.sep=e.sep,this.cls=e.cls}post_process(e,t,r=!0){r&&(e=We([this.cls[0]],e,[this.sep[0]]));let i=new Array(e.length).fill(0);if(t){const n=r?[this.sep[0]]:[],a=r?[this.sep[0]]:[];e=We(e,n,t,a),i=We(i,new Array(t.length+n.length+a.length).fill(1))}return{tokens:e,token_type_ids:i}}},Dg=Mg,Pg=class extends Jt{constructor(e){super(e),this.processors=(e.processors??[]).map(t=>Da(t))}post_process(e,t=null,r=!0){let i={tokens:e,tokens_pair:t};for(const n of this.processors)i=n.post_process(i.tokens,i.tokens_pair,r);return i}},Ug=Pg;function qg(e){if(e===null)return null;switch(e.type){case"TemplateProcessing":return new Ag(e);case"ByteLevel":return new Rg(e);case"BertProcessing":return new Ng(e);case"RobertaProcessing":return new Dg(e);case"Sequence":return new Ug(e);default:throw new Error(`Unknown PostProcessor type: ${e.type}`)}}var Da=qg,Lg=class extends Yt{constructor(e){super(),this.config=e,this.added_tokens=[],this.end_of_word_suffix=null,this.trim_offsets="trim_offsets"in e?e.trim_offsets:!1}_call(e){return this.decode(e)}decode(e){return this.decode_chain(e).join("")}},Ye=Lg,Wg=class extends Ye{constructor(e){super(e),this.byte_decoder=nm,this.text_decoder=new TextDecoder("utf-8",{fatal:!1,ignoreBOM:!0}),this.end_of_word_suffix=null}convert_tokens_to_string(e){const t=e.join(""),r=new Uint8Array([...t].map(i=>this.byte_decoder[i]));return this.text_decoder.decode(r)}decode_chain(e){const t=[];let r=[];for(const i of e)this.added_tokens.find(n=>n.content===i)!==void 0?(r.length>0&&(t.push(this.convert_tokens_to_string(r)),r=[]),t.push(i)):r.push(i);return r.length>0&&t.push(this.convert_tokens_to_string(r)),t}},Vg=Wg,Gg=class extends Ye{constructor(e){super(e),this.cleanup=e.cleanup}decode_chain(e){return e.map((t,r)=>{if(r!==0){const i=this.config.prefix;i&&t.startsWith(i)?t=t.replace(i,""):t=" "+t}return this.cleanup&&(t=di(t)),t})}},Fg=Gg,Hg=class extends Ye{constructor(e){super(e),this.replacement=e.replacement??"▁"}decode_chain(e){const t=[];for(let r=0;r<e.length;++r){let i=e[r].replaceAll(this.replacement," ");r==0&&i.startsWith(" ")&&(i=i.substring(1)),t.push(i)}return t}},jg=Hg,Kg=class extends Ye{constructor(e){super(e),this.suffix=e.suffix??""}decode_chain(e){return e.map((t,r)=>t.replaceAll(this.suffix,r===e.length-1?"":" "))}},Zg=Kg,Xg=class extends Ye{constructor(e){super(e),this.pad_token=e.pad_token??"",this.word_delimiter_token=e.word_delimiter_token??"",this.cleanup=e.cleanup}convert_tokens_to_string(e){if(e.length===0)return"";const t=[e[0]];for(let n=1;n<e.length;++n)e[n]!==t.at(-1)&&t.push(e[n]);let i=t.filter(n=>n!==this.pad_token).join("");return this.cleanup&&(i=di(i).replaceAll(this.word_delimiter_token," ").trim()),i}decode_chain(e){return[this.convert_tokens_to_string(e)]}},Qg=Xg,Yg=class extends Ye{constructor(e){super(e),this.decoders=(e.decoders??[]).map(t=>Pa(t))}decode_chain(e){return this.decoders.reduce((t,r)=>r.decode_chain(t),e)}},Jg=Yg,e_=class extends Ye{decode_chain(e){const t=xr(this.config.pattern),r=this.config.content??"";return t===null?e:e.map(i=>i.replaceAll(t,r))}},t_=e_,r_=class extends Ye{decode_chain(e){return[e.join("")]}},i_=r_,n_=class extends Ye{constructor(e){super(e),this.content=e.content??"",this.start=e.start??0,this.stop=e.stop??0}decode_chain(e){return e.map(t=>{let r=0;for(let n=0;n<this.start&&t[n]===this.content;++n){r=n+1;continue}let i=t.length;for(let n=0;n<this.stop;++n){const a=t.length-n-1;if(t[a]===this.content){i=a;continue}else break}return t.slice(r,i)})}},a_=n_,s_=class extends Ye{constructor(e){super(e),this.text_decoder=new TextDecoder}decode_chain(e){const t=[];let r=[];for(const i of e){let n=null;if(i.length===6&&i.startsWith("<0x")&&i.endsWith(">")){const a=parseInt(i.slice(3,5),16);isNaN(a)||(n=a)}if(n!==null)r.push(n);else{if(r.length>0){const a=this.text_decoder.decode(Uint8Array.from(r));t.push(a),r=[]}t.push(i)}}if(r.length>0){const i=this.text_decoder.decode(Uint8Array.from(r));t.push(i),r=[]}return t}},o_=s_;function u_(e){if(e===null)return null;switch(e.type){case"ByteLevel":return new Vg(e);case"WordPiece":return new Fg(e);case"Metaspace":return new jg(e);case"BPEDecoder":return new Zg(e);case"CTC":return new Qg(e);case"Sequence":return new Jg(e);case"Replace":return new t_(e);case"Fuse":return new i_(e);case"Strip":return new a_(e);case"ByteFallback":return new o_(e);default:throw new Error(`Unknown Decoder type: ${e.type}`)}}var Pa=u_,l_=class{constructor(e,t){const r=Ca(e,"Tokenizer",["model","decoder","post_processor","pre_tokenizer","normalizer"]);if(r)throw new Error(r);const i=Ca(t,"Config");if(i)throw new Error(i);this.tokenizer=e,this.config=t,this.normalizer=Aa(this.tokenizer.normalizer),this.pre_tokenizer=Oa(this.tokenizer.pre_tokenizer),this.model=Eg(this.tokenizer.model,this.config),this.post_processor=Da(this.tokenizer.post_processor),this.decoder=Pa(this.tokenizer.decoder),this.special_tokens=[],this.all_special_ids=[],this.added_tokens=[];const n=[],a=[];this.added_tokens_map=new Map;for(const s of this.tokenizer.added_tokens){const u=new rm(s);if(this.added_tokens.push(u),this.model.tokens_to_ids.set(u.content,u.id),this.model.vocab[u.id]=u.content,u.special&&(this.special_tokens.push(u.content),this.all_special_ids.push(u.id)),this.added_tokens_map.set(u.content,u),u.normalized&&this.normalizer!==null){const l=this.normalizer(u.content);a.push(l),this.added_tokens_map.set(l,u)}else n.push(u.content)}(this.config.additional_special_tokens??[]).forEach(s=>{this.special_tokens.includes(s)||this.special_tokens.push(s)}),this.decoder&&(this.decoder.added_tokens=this.added_tokens,this.decoder.end_of_word_suffix=this.model.end_of_word_suffix),this.splitter_unnormalized=new Ta(n),this.splitter_normalized=new Ta(a),this.remove_space=this.config.remove_space,this.clean_up_tokenization_spaces=this.config.clean_up_tokenization_spaces??!0,this.do_lowercase_and_remove_accent=this.config.do_lowercase_and_remove_accent??!1}encode(e,{text_pair:t=null,add_special_tokens:r=!0,return_token_type_ids:i=null}={}){const{tokens:n,token_type_ids:a}=this.tokenize_helper(e,{text_pair:t,add_special_tokens:r}),s=n.map(l=>this.added_tokens_map.get(l)?.id??this.model.tokens_to_ids.get(l)??this.model.unk_token_id),u={ids:s,tokens:n,attention_mask:new Array(s.length).fill(1)};return i&&a&&(u.token_type_ids=a),u}decode(e,t={}){if(!Array.isArray(e)||e.length===0||!lm(e[0]))throw Error("token_ids must be a non-empty array of integers.");let r=e.map(n=>this.model.vocab[Number(n)]??this.model.unk_token);t.skip_special_tokens&&(r=r.filter(n=>!this.special_tokens.includes(n)));let i=this.decoder?this.decoder(r):r.join(" ");return this.decoder&&this.decoder.end_of_word_suffix&&(i=i.replaceAll(this.decoder.end_of_word_suffix," "),t.skip_special_tokens&&(i=i.trim())),(t.clean_up_tokenization_spaces??this.clean_up_tokenization_spaces)&&(i=di(i)),i}tokenize(e,{text_pair:t=null,add_special_tokens:r=!1}={}){return this.tokenize_helper(e,{text_pair:t,add_special_tokens:r}).tokens}encode_text(e){if(e===null)return null;const t=this.splitter_unnormalized.split(e);return t.forEach((r,i)=>{const n=this.added_tokens_map.get(r);n&&(n.lstrip&&i>0&&(t[i-1]=t[i-1].trimEnd()),n.rstrip&&i<t.length-1&&(t[i+1]=t[i+1].trimStart()))}),t.flatMap((r,i)=>{if(r.length===0)return[];if(this.added_tokens_map.has(r))return[r];if(this.remove_space===!0&&(r=r.trim().split(/\s+/).join(" ")),this.do_lowercase_and_remove_accent&&(r=pm(r)),this.normalizer!==null&&(r=this.normalizer(r)),r.length===0)return[];const n=this.splitter_normalized.split(r);return n.forEach((a,s)=>{const u=this.added_tokens_map.get(a);u&&(u.lstrip&&s>0&&(n[s-1]=n[s-1].trimEnd()),u.rstrip&&s<n.length-1&&(n[s+1]=n[s+1].trimStart()))}),n.flatMap(a=>{if(a.length===0)return[];if(this.added_tokens_map.has(a))return[a];const s=this.pre_tokenizer!==null?this.pre_tokenizer(a,{section_index:i}):[a];return this.model(s)})})}tokenize_helper(e,{text_pair:t=null,add_special_tokens:r=!0}){const i=this.encode_text(e),n=this.encode_text(t||null);return this.post_processor?this.post_processor(i,n,r):{tokens:We(i??[],n??[])}}token_to_id(e){return this.model.tokens_to_ids.get(e)}id_to_token(e){return this.model.vocab[e]}get_added_tokens_decoder(){const e=new Map;for(const t of this.added_tokens)e.set(t.id,t);return e}get_vocab(e=!0){const t=new Map;for(let r=0;r<this.model.vocab.length;++r){const i=this.model.vocab[r];(e||!this.added_tokens_map.has(i))&&t.set(i,r)}return t}},d_=l_;var hi=Object.defineProperty,p_=Object.getOwnPropertyDescriptor,c_=Object.getOwnPropertyNames,h_=Object.prototype.hasOwnProperty,f_=(e=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof require<"u"?require:t)[r]}):e)(function(e){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')}),U=(e,t)=>()=>(e&&(t=e(e=0)),t),Wt=(e,t)=>{for(var r in t)hi(e,r,{get:t[r],enumerable:!0})},m_=(e,t,r,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let n of c_(t))!h_.call(e,n)&&n!==r&&hi(e,n,{get:()=>t[n],enumerable:!(i=p_(t,n))||i.enumerable});return e},er=e=>m_(hi({},"__esModule",{value:!0}),e),tr,ct,Vt,Ua,qa,La=U(()=>{tr=new Map,ct=[],Vt=(e,t,r)=>{if(t&&typeof t.init=="function"&&typeof t.createInferenceSessionHandler=="function"){let i=tr.get(e);if(i===void 0)tr.set(e,{backend:t,priority:r});else{if(i.priority>r)return;if(i.priority===r&&i.backend!==t)throw new Error(`cannot register backend "${e}" using priority ${r}`)}if(r>=0){let n=ct.indexOf(e);n!==-1&&ct.splice(n,1);for(let a=0;a<ct.length;a++)if(tr.get(ct[a]).priority<=r){ct.splice(a,0,e);return}ct.push(e)}return}throw new TypeError("not a valid backend")},Ua=async e=>{let t=tr.get(e);if(!t)return"backend not found.";if(t.initialized)return t.backend;if(t.aborted)return t.error;{let r=!!t.initPromise;try{return r||(t.initPromise=t.backend.init(e)),await t.initPromise,t.initialized=!0,t.backend}catch(i){return r||(t.error=`${i}`,t.aborted=!0),t.error}finally{delete t.initPromise}}},qa=async e=>{let t=e.executionProviders||[],r=t.map(l=>typeof l=="string"?l:l.name),i=r.length===0?ct:r,n,a=[],s=new Set;for(let l of i){let d=await Ua(l);typeof d=="string"?a.push({name:l,err:d}):(n||(n=d),n===d&&s.add(l))}if(!n)throw new Error(`no available backend found. ERR: ${a.map(l=>`[${l.name}] ${l.err}`).join(", ")}`);for(let{name:l,err:d}of a)r.includes(l)&&console.warn(`removing requested execution provider "${l}" from session options because it is not available: ${d}`);let u=t.filter(l=>s.has(typeof l=="string"?l:l.name));return[n,new Proxy(e,{get:(l,d)=>d==="executionProviders"?u:Reflect.get(l,d)})]}}),g_=U(()=>{La()}),Wa,__=U(()=>{Wa="1.27.0"}),fi,Ee,Va=U(()=>{__(),fi="warning",Ee={wasm:{},webgl:{},webgpu:{},versions:{common:Wa},set logLevel(e){if(e!==void 0){if(typeof e!="string"||["verbose","info","warning","error","fatal"].indexOf(e)===-1)throw new Error(`Unsupported logging level: ${e}`);fi=e}},get logLevel(){return fi}},Object.defineProperty(Ee,"logLevel",{enumerable:!0})}),be,y_=U(()=>{Va(),be=Ee}),Ga,Fa,b_=U(()=>{Ga=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);r.width=e.dims[3],r.height=e.dims[2];let i=r.getContext("2d");if(i!=null){let n,a;t?.tensorLayout!==void 0&&t.tensorLayout==="NHWC"?(n=e.dims[2],a=e.dims[3]):(n=e.dims[3],a=e.dims[2]);let s=t?.format!==void 0?t.format:"RGB",u=t?.norm,l,d;u===void 0||u.mean===void 0?l=[255,255,255,255]:typeof u.mean=="number"?l=[u.mean,u.mean,u.mean,u.mean]:(l=[u.mean[0],u.mean[1],u.mean[2],0],u.mean[3]!==void 0&&(l[3]=u.mean[3])),u===void 0||u.bias===void 0?d=[0,0,0,0]:typeof u.bias=="number"?d=[u.bias,u.bias,u.bias,u.bias]:(d=[u.bias[0],u.bias[1],u.bias[2],0],u.bias[3]!==void 0&&(d[3]=u.bias[3]));let c=a*n,f=0,g=c,_=c*2,y=-1;s==="RGBA"?(f=0,g=c,_=c*2,y=c*3):s==="RGB"?(f=0,g=c,_=c*2):s==="RBG"&&(f=0,_=c,g=c*2);for(let $=0;$<a;$++)for(let S=0;S<n;S++){let x=(e.data[f++]-d[0])*l[0],b=(e.data[g++]-d[1])*l[1],z=(e.data[_++]-d[2])*l[2],k=y===-1?255:(e.data[y++]-d[3])*l[3];i.fillStyle="rgba("+x+","+b+","+z+","+k+")",i.fillRect(S,$,1,1)}if("toDataURL"in r)return r.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},Fa=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),i;if(r!=null){let n,a,s;t?.tensorLayout!==void 0&&t.tensorLayout==="NHWC"?(n=e.dims[2],a=e.dims[1],s=e.dims[3]):(n=e.dims[3],a=e.dims[2],s=e.dims[1]);let u=t!==void 0&&t.format!==void 0?t.format:"RGB",l=t?.norm,d,c;l===void 0||l.mean===void 0?d=[255,255,255,255]:typeof l.mean=="number"?d=[l.mean,l.mean,l.mean,l.mean]:(d=[l.mean[0],l.mean[1],l.mean[2],255],l.mean[3]!==void 0&&(d[3]=l.mean[3])),l===void 0||l.bias===void 0?c=[0,0,0,0]:typeof l.bias=="number"?c=[l.bias,l.bias,l.bias,l.bias]:(c=[l.bias[0],l.bias[1],l.bias[2],0],l.bias[3]!==void 0&&(c[3]=l.bias[3]));let f=a*n;if(t!==void 0&&(t.format!==void 0&&s===4&&t.format!=="RGBA"||s===3&&t.format!=="RGB"&&t.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let g=4,_=0,y=1,$=2,S=3,x=0,b=f,z=f*2,k=-1;u==="RGBA"?(x=0,b=f,z=f*2,k=f*3):u==="RGB"?(x=0,b=f,z=f*2):u==="RBG"&&(x=0,z=f,b=f*2),i=r.createImageData(n,a);for(let E=0;E<a*n;_+=g,y+=g,$+=g,S+=g,E++)i.data[_]=(e.data[x++]-c[0])*d[0],i.data[y]=(e.data[b++]-c[1])*d[1],i.data[$]=(e.data[z++]-c[2])*d[2],i.data[S]=k===-1?255:(e.data[k++]-c[3])*d[3]}else throw new Error("Can not access image data");return i}}),Tr,Ha,ja,Ka,Za,Xa,w_=U(()=>{gi(),Tr=(e,t)=>{if(e===void 0)throw new Error("Image buffer must be defined");if(t.height===void 0||t.width===void 0)throw new Error("Image height and width must be defined");if(t.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:r,width:i}=t,n=t.norm??{mean:255,bias:0},a,s;typeof n.mean=="number"?a=[n.mean,n.mean,n.mean,n.mean]:a=[n.mean[0],n.mean[1],n.mean[2],n.mean[3]??255],typeof n.bias=="number"?s=[n.bias,n.bias,n.bias,n.bias]:s=[n.bias[0],n.bias[1],n.bias[2],n.bias[3]??0];let u=t.format!==void 0?t.format:"RGBA",l=t.tensorFormat!==void 0&&t.tensorFormat!==void 0?t.tensorFormat:"RGB",d=r*i,c=l==="RGBA"?new Float32Array(d*4):new Float32Array(d*3),f=4,g=0,_=1,y=2,$=3,S=0,x=d,b=d*2,z=-1;u==="RGB"&&(f=3,g=0,_=1,y=2,$=-1),l==="RGBA"?z=d*3:l==="RBG"?(S=0,b=d,x=d*2):l==="BGR"&&(b=0,x=d,S=d*2);for(let k=0;k<d;k++,g+=f,y+=f,_+=f,$+=f)c[S++]=(e[g]+s[0])/a[0],c[x++]=(e[_]+s[1])/a[1],c[b++]=(e[y]+s[2])/a[2],z!==-1&&$!==-1&&(c[z++]=(e[$]+s[3])/a[3]);return l==="RGBA"?new Ne("float32",c,[1,4,r,i]):new Ne("float32",c,[1,3,r,i])},Ha=async(e,t)=>{let r=typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement,i=typeof ImageData<"u"&&e instanceof ImageData,n=typeof ImageBitmap<"u"&&e instanceof ImageBitmap,a=typeof e=="string",s,u=t??{},l=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},d=c=>typeof HTMLCanvasElement<"u"&&c instanceof HTMLCanvasElement||c instanceof OffscreenCanvas?c.getContext("2d"):null;if(r){let c=l();c.width=e.width,c.height=e.height;let f=d(c);if(f!=null){let g=e.height,_=e.width;if(t!==void 0&&t.resizedHeight!==void 0&&t.resizedWidth!==void 0&&(g=t.resizedHeight,_=t.resizedWidth),t!==void 0){if(u=t,t.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");u.tensorFormat="RGBA",u.height=g,u.width=_}else u.tensorFormat="RGBA",u.height=g,u.width=_;f.drawImage(e,0,0),s=f.getImageData(0,0,_,g).data}else throw new Error("Can not access image data")}else if(i){let c,f;if(t!==void 0&&t.resizedWidth!==void 0&&t.resizedHeight!==void 0?(c=t.resizedHeight,f=t.resizedWidth):(c=e.height,f=e.width),t!==void 0&&(u=t),u.format="RGBA",u.height=c,u.width=f,t!==void 0){let g=l();g.width=f,g.height=c;let _=d(g);if(_!=null)_.putImageData(e,0,0),s=_.getImageData(0,0,f,c).data;else throw new Error("Can not access image data")}else s=e.data}else if(n){if(t===void 0)throw new Error("Please provide image config with format for Imagebitmap");let c=l();c.width=e.width,c.height=e.height;let f=d(c);if(f!=null){let g=e.height,_=e.width;return f.drawImage(e,0,0,_,g),s=f.getImageData(0,0,_,g).data,u.height=g,u.width=_,Tr(s,u)}else throw new Error("Can not access image data")}else{if(a)return new Promise((c,f)=>{let g=l(),_=d(g);if(!e||!_)return f();let y=new Image;y.crossOrigin="Anonymous",y.src=e,y.onload=()=>{g.width=y.width,g.height=y.height,_.drawImage(y,0,0,g.width,g.height);let $=_.getImageData(0,0,g.width,g.height);u.height=g.height,u.width=g.width,c(Tr($.data,u))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(s!==void 0)return Tr(s,u);throw new Error("Input data provided is not supported - aborted tensor creation")},ja=(e,t)=>{let{width:r,height:i,download:n,dispose:a}=t,s=[1,i,r,4];return new Ne({location:"texture",type:"float32",texture:e,dims:s,download:n,dispose:a})},Ka=(e,t)=>{let{dataType:r,dims:i,download:n,dispose:a}=t;return new Ne({location:"gpu-buffer",type:r??"float32",gpuBuffer:e,dims:i,download:n,dispose:a})},Za=(e,t)=>{let{dataType:r,dims:i,download:n,dispose:a}=t;return new Ne({location:"ml-tensor",type:r??"float32",mlTensor:e,dims:i,download:n,dispose:a})},Xa=(e,t,r)=>new Ne({location:"cpu-pinned",type:e,data:t,dims:r??[t.length]})}),xt,rr,mi,Qa,$_=U(()=>{xt=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),rr=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),mi=!1,Qa=()=>{if(!mi){mi=!0;let e=typeof BigInt64Array<"u"&&BigInt64Array.from,t=typeof BigUint64Array<"u"&&BigUint64Array.from,r=globalThis.Float16Array,i=typeof r<"u"&&r.from;e&&(xt.set("int64",BigInt64Array),rr.set(BigInt64Array,"int64")),t&&(xt.set("uint64",BigUint64Array),rr.set(BigUint64Array,"uint64")),i?(xt.set("float16",r),rr.set(r,"float16")):xt.set("float16",Uint16Array)}}}),Ya,Ja,v_=U(()=>{gi(),Ya=e=>{let t=1;for(let r=0;r<e.length;r++){let i=e[r];if(typeof i!="number"||!Number.isSafeInteger(i))throw new TypeError(`dims[${r}] must be an integer, got: ${i}`);if(i<0)throw new RangeError(`dims[${r}] must be a non-negative integer, got: ${i}`);t*=i}return t},Ja=(e,t)=>{switch(e.location){case"cpu":return new Ne(e.type,e.data,t);case"cpu-pinned":return new Ne({location:"cpu-pinned",data:e.data,type:e.type,dims:t});case"texture":return new Ne({location:"texture",texture:e.texture,type:e.type,dims:t});case"gpu-buffer":return new Ne({location:"gpu-buffer",gpuBuffer:e.gpuBuffer,type:e.type,dims:t});case"ml-tensor":return new Ne({location:"ml-tensor",mlTensor:e.mlTensor,type:e.type,dims:t});default:throw new Error(`tensorReshape: tensor location ${e.location} is not supported`)}}}),Ne,gi=U(()=>{b_(),w_(),$_(),v_(),Ne=class{constructor(e,t,r){Qa();let i,n;if(typeof e=="object"&&"location"in e)switch(this.dataLocation=e.location,i=e.type,n=e.dims,e.location){case"cpu-pinned":{let s=xt.get(i);if(!s)throw new TypeError(`unsupported type "${i}" to create tensor from pinned buffer`);if(!(e.data instanceof s))throw new TypeError(`buffer should be of type ${s.name}`);this.cpuData=e.data;break}case"texture":{if(i!=="float32")throw new TypeError(`unsupported type "${i}" to create tensor from texture`);this.gpuTextureData=e.texture,this.downloader=e.download,this.disposer=e.dispose;break}case"gpu-buffer":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from gpu buffer`);this.gpuBufferData=e.gpuBuffer,this.downloader=e.download,this.disposer=e.dispose;break}case"ml-tensor":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint64"&&i!=="int8"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from MLTensor`);this.mlTensorData=e.mlTensor,this.downloader=e.download,this.disposer=e.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let s,u;if(typeof e=="string")if(i=e,u=r,e==="string"){if(!Array.isArray(t))throw new TypeError("A string tensor's data must be a string array.");s=t}else{let l=xt.get(e);if(l===void 0)throw new TypeError(`Unsupported tensor type: ${e}.`);if(Array.isArray(t)){if(e==="float16"&&l===Uint16Array||e==="uint4"||e==="int4")throw new TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${l.name} as data.`);e==="uint64"||e==="int64"?s=l.from(t,BigInt):s=l.from(t)}else if(t instanceof l)s=t;else if(t instanceof Uint8ClampedArray)if(e==="uint8")s=Uint8Array.from(t);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(e==="float16"&&t instanceof Uint16Array&&l!==Uint16Array)s=new globalThis.Float16Array(t.buffer,t.byteOffset,t.length);else throw new TypeError(`A ${i} tensor's data must be type of ${l}`)}else if(u=t,Array.isArray(e)){if(e.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let l=typeof e[0];if(l==="string")i="string",s=e;else if(l==="boolean")i="bool",s=Uint8Array.from(e);else throw new TypeError(`Invalid element type of data array: ${l}.`)}else if(e instanceof Uint8ClampedArray)i="uint8",s=Uint8Array.from(e);else{let l=rr.get(e.constructor);if(l===void 0)throw new TypeError(`Unsupported type for tensor data: ${e.constructor}.`);i=l,s=e}if(u===void 0)u=[s.length];else if(!Array.isArray(u))throw new TypeError("A tensor's dims must be a number array");n=u,this.cpuData=s,this.dataLocation="cpu"}let a=Ya(n);if(this.cpuData&&a!==this.cpuData.length&&!((i==="uint4"||i==="int4")&&Math.ceil(a/2)===this.cpuData.length))throw new Error(`Tensor's size(${a}) does not match data length(${this.cpuData.length}).`);this.type=i,this.dims=n,this.size=a}static async fromImage(e,t){return Ha(e,t)}static fromTexture(e,t){return ja(e,t)}static fromGpuBuffer(e,t){return Ka(e,t)}static fromMLTensor(e,t){return Za(e,t)}static fromPinnedBuffer(e,t,r){return Xa(e,t,r)}toDataURL(e){return Ga(this,e)}toImageData(e){return Fa(this,e)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(e){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let t=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=t,e&&this.disposer&&(this.disposer(),this.disposer=void 0),t}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(e){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return Ja(this,e)}}}),Me,es=U(()=>{gi(),Me=Ne}),zr,_i,Je,Ge,kt,St,ts=U(()=>{Va(),zr=(e,t)=>{(typeof Ee.trace>"u"?!Ee.wasm.trace:!Ee.trace)||console.timeStamp(`${e}::ORT::${t}`)},_i=(e,t)=>{let r=new Error().stack?.split(/\r\n|\r|\n/g)||[],i=!1;for(let n=0;n<r.length;n++){if(i&&!r[n].includes("TRACE_FUNC")){let a=`FUNC_${e}::${r[n].trim().split(" ")[1]}`;t&&(a+=`::${t}`),zr("CPU",a);return}r[n].includes("TRACE_FUNC")&&(i=!0)}},Je=e=>{(typeof Ee.trace>"u"?!Ee.wasm.trace:!Ee.trace)||_i("BEGIN",e)},Ge=e=>{(typeof Ee.trace>"u"?!Ee.wasm.trace:!Ee.trace)||_i("END",e)},kt=e=>{(typeof Ee.trace>"u"?!Ee.wasm.trace:!Ee.trace)||console.time(`ORT::${e}`)},St=e=>{(typeof Ee.trace>"u"?!Ee.wasm.trace:!Ee.trace)||console.timeEnd(`ORT::${e}`)}}),rs,x_=U(()=>{La(),es(),ts(),rs=class Yf{constructor(t){this.handler=t}async run(t,r,i){Je(),kt("InferenceSession.run");let n={},a={};if(typeof t!="object"||t===null||t instanceof Me||Array.isArray(t))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let s=!0;if(typeof r=="object"){if(r===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if(r instanceof Me)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray(r)){if(r.length===0)throw new TypeError("'fetches' cannot be an empty array.");s=!1;for(let d of r){if(typeof d!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(d)===-1)throw new RangeError(`'fetches' contains invalid output name: ${d}.`);n[d]=null}if(typeof i=="object"&&i!==null)a=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else{let d=!1,c=Object.getOwnPropertyNames(r);for(let f of this.outputNames)if(c.indexOf(f)!==-1){let g=r[f];(g===null||g instanceof Me)&&(d=!0,s=!1,n[f]=g)}if(d){if(typeof i=="object"&&i!==null)a=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else a=r}}else if(typeof r<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let d of this.inputNames)if(typeof t[d]>"u")throw new Error(`input '${d}' is missing in 'feeds'.`);if(s)for(let d of this.outputNames)n[d]=null;let u=await this.handler.run(t,n,a),l={};for(let d in u)if(Object.hasOwnProperty.call(u,d)){let c=u[d];c instanceof Me?l[d]=c:l[d]=new Me(c.type,c.data,c.dims)}return St("InferenceSession.run"),Ge(),l}async release(){return this.handler.dispose()}static async create(t,r,i,n){Je(),kt("InferenceSession.create");let a,s={};if(typeof t=="string"){if(a=t,typeof r=="object"&&r!==null)s=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof Uint8Array){if(a=t,typeof r=="object"&&r!==null)s=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&t instanceof SharedArrayBuffer){let c=t,f=0,g=t.byteLength;if(typeof r=="object"&&r!==null)s=r;else if(typeof r=="number"){if(f=r,!Number.isSafeInteger(f))throw new RangeError("'byteOffset' must be an integer.");if(f<0||f>=c.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${c.byteLength}).`);if(g=t.byteLength-f,typeof i=="number"){if(g=i,!Number.isSafeInteger(g))throw new RangeError("'byteLength' must be an integer.");if(g<=0||f+g>c.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${c.byteLength-f}].`);if(typeof n=="object"&&n!==null)s=n;else if(typeof n<"u")throw new TypeError("'options' must be an object.")}else if(typeof i<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof r<"u")throw new TypeError("'options' must be an object.");a=new Uint8Array(c,f,g)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[u,l]=await qa(s),d=await u.createInferenceSessionHandler(a,l);return St("InferenceSession.create"),Ge(),new Yf(d)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}}),yi,k_=U(()=>{x_(),yi=rs}),S_=U(()=>{}),T_=U(()=>{}),z_=U(()=>{}),E_=U(()=>{}),I_={};Wt(I_,{InferenceSession:()=>yi,TRACE:()=>zr,TRACE_EVENT_BEGIN:()=>kt,TRACE_EVENT_END:()=>St,TRACE_FUNC_BEGIN:()=>Je,TRACE_FUNC_END:()=>Ge,Tensor:()=>Me,env:()=>be,registerBackend:()=>Vt});var Ue=U(()=>{g_(),y_(),k_(),es(),S_(),T_(),ts(),z_(),E_()}),bi=U(()=>{}),is={};Wt(is,{default:()=>ns});var wi,$i,ns,C_=U(()=>{Uc(),Tt(),zi(),wi="ort-wasm-proxy-worker",$i=globalThis.self?.name===wi,$i&&(self.onmessage=e=>{let{type:t,in:r}=e.data;try{switch(t){case"init-wasm":Ci(r.wasm).then(()=>{Wn(r).then(()=>{postMessage({type:t})},i=>{postMessage({type:t,err:i})})},i=>{postMessage({type:t,err:i})});break;case"init-ep":{let{epName:i,env:n}=r;Vn(n,i).then(()=>{postMessage({type:t})},a=>{postMessage({type:t,err:a})});break}case"copy-from":{let{buffer:i}=r,n=Hr(i);postMessage({type:t,out:n});break}case"create":{let{model:i,options:n}=r;Fn(i,n).then(a=>{postMessage({type:t,out:a})},a=>{postMessage({type:t,err:a})});break}case"release":Hn(r),postMessage({type:t});break;case"run":{let{sessionId:i,inputIndices:n,inputs:a,outputIndices:s,options:u}=r;Kn(i,n,a,s,new Array(s.length).fill(null),u).then(l=>{l.some(d=>d[3]!=="cpu")?postMessage({type:t,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:t,out:l},Xn([...a,...l]))},l=>{postMessage({type:t,err:l})});break}case"end-profiling":Zn(r),postMessage({type:t});break;default:}}catch(i){postMessage({type:t,err:i})}}),ns=$i?null:e=>new Worker(e??De,{type:"module",name:wi})}),as={};Wt(as,{default:()=>os});async function ss(e={}){var t=e,r=!!globalThis.window,i=!!globalThis.WorkerGlobalScope,n=i&&self.name?.startsWith("em-pthread");t.mountExternalData=(o,p)=>{o.startsWith("./")&&(o=o.substring(2)),(t.Xc||(t.Xc=new Map)).set(o,p)},t.unmountExternalData=()=>{delete t.Xc},globalThis.SharedArrayBuffer??new WebAssembly.Memory({initial:0,maximum:0,shared:!0}).buffer.constructor;let a=o=>async(...p)=>{try{if(t.Yc)throw Error("Session already started");let m=t.Yc={Kd:p[0],errors:[]},h=await o(...p);if(t.Yc!==m)throw Error("Session mismatch");t.dd?.flush();let w=m.errors;if(0<w.length){let T=await Promise.all(w);if(T=T.filter(I=>I),0<T.length)throw Error(T.join(`
`))}return h}finally{t.Yc=null}};t.jsepInit=(o,p)=>{if(o==="webgpu"){[t.dd,t.Ad,t.Ed,t.ed,t.Dd,t.$b,t.Fd,t.Hd,t.Bd,t.Cd,t.Gd]=p;let m=t.dd;t.jsepRegisterBuffer=(h,w,T,I)=>m.registerBuffer(h,w,T,I),t.jsepGetBuffer=h=>m.getBuffer(h),t.jsepCreateDownloader=(h,w,T)=>m.createDownloader(h,w,T),t.jsepOnCreateSession=h=>{m.onCreateSession(h)},t.jsepOnReleaseSession=h=>{m.onReleaseSession(h)},t.jsepOnRunStart=h=>m.onRunStart(h),t.Id=(h,w)=>{m.upload(h,w)}}else if(o==="webnn"){let m=p[0];[t.Sd,t.sd,t.webnnEnsureTensor,t.td,t.webnnDownloadTensor,t.Rd,t.webnnEnableTraceEvent]=p.slice(1),t.webnnReleaseTensorId=t.sd,t.webnnUploadTensor=t.td,t.webnnRegisterMLContext=t.Rd,t.webnnOnRunStart=h=>m.onRunStart(h),t.webnnOnRunEnd=m.onRunEnd.bind(m),t.webnnOnReleaseSession=h=>{m.onReleaseSession(h)},t.webnnCreateMLTensorDownloader=(h,w)=>m.createMLTensorDownloader(h,w),t.webnnRegisterMLTensor=(h,w,T,I)=>m.registerMLTensor(h,w,T,I),t.webnnCreateMLContext=h=>m.createMLContext(h),t.webnnRegisterMLConstant=(h,w,T,I,B,L)=>m.registerMLConstant(h,w,T,I,B,t.Xc,L),t.webnnRegisterGraphInput=m.registerGraphInput.bind(m),t.webnnIsGraphInput=m.isGraphInput.bind(m),t.webnnRegisterGraphOutput=m.registerGraphOutput.bind(m),t.webnnIsGraphOutput=m.isGraphOutput.bind(m),t.webnnCreateTemporaryTensor=m.createTemporaryTensor.bind(m),t.webnnIsGraphInputOutputTypeSupported=m.isGraphInputOutputTypeSupported.bind(m)}};let s=()=>{let o=p=>(...m)=>{let h=it;return m=p(...m),it!=h?new Promise((w,T)=>{ha={resolve:w,reject:T}}):m};(()=>{for(let p of["_OrtAppendExecutionProvider","_OrtCreateSession","_OrtRun","_OrtRunWithBinding","_OrtBindInput"])t[p]=o(t[p])})(),a!==void 0&&(t._OrtRun=a(t._OrtRun),t._OrtRunWithBinding=a(t._OrtRunWithBinding)),s=void 0};t.asyncInit=()=>{s?.()};var u,l,d=(o,p)=>{throw p},c=self.location.href,f="";if(r||i){try{f=new URL(".",c).href}catch{}i&&(l=o=>{var p=new XMLHttpRequest;return p.open("GET",o,!1),p.responseType="arraybuffer",p.send(null),new Uint8Array(p.response)}),u=async o=>{if(C(o))return new Promise((m,h)=>{var w=new XMLHttpRequest;w.open("GET",o,!0),w.responseType="arraybuffer",w.onload=()=>{w.status==200||w.status==0&&w.response?m(w.response):h(w.status)},w.onerror=h,w.send(null)});var p=await fetch(o,{credentials:"same-origin"});if(p.ok)return p.arrayBuffer();throw Error(p.status+" : "+p.url)}}var g,_,y,$,S,x,b=console.log.bind(console),z=console.error.bind(console),k=b,E=z,A=!1,C=o=>o.startsWith("file://");function v(){bt.buffer!=q.buffer&&Y()}if(n){let o=function(p){try{var m=p.data,h=m.Sc;if(h==="load"){let w=[];self.onmessage=T=>w.push(T),x=()=>{postMessage({Sc:"loaded"});for(let T of w)o(T);self.onmessage=o};for(let T of m.xd)t[T]&&!t[T].proxy||(t[T]=(...I)=>{postMessage({Sc:"callHandler",wd:T,args:I})},T=="print"&&(k=t[T]),T=="printErr"&&(E=t[T]));bt=m.Od,Y(),_=m.Pd,Ce(),ui()}else if(h==="run"){(function(w){var T=(v(),M)[w+52>>>2>>>0];w=(v(),M)[w+56>>>2>>>0],sf(T,T-w),oe(T)})(m.Rc),ya(m.Rc,0,0,1,0,0),sh(),da(m.Rc),D||(Jh(),D=!0);try{G0(m.Md,m.bd)}catch(w){if(w!="unwind")throw w}}else m.target!=="setimmediate"&&(h==="checkMailbox"?D&&ti():h&&(E(`worker: received unknown command ${h}`),E(m)))}catch(w){throw ef(),w}};var D=!1;self.onunhandledrejection=p=>{throw p.reason||p},self.onmessage=o}var q,Q,H,Z,R,M,G,J,ee,re,ae,P=!1;function Y(){var o=bt.buffer;t.HEAP8=q=new Int8Array(o),H=new Int16Array(o),t.HEAPU8=Q=new Uint8Array(o),Z=new Uint16Array(o),t.HEAP32=R=new Int32Array(o),t.HEAPU32=M=new Uint32Array(o),G=new Float32Array(o),J=new Float64Array(o),ee=new BigInt64Array(o),re=new BigUint64Array(o)}function X(){P=!0,n?x():pt.sb()}function V(o){throw E(o="Aborted("+o+")"),A=!0,o=new WebAssembly.RuntimeError(o+". Build with -sASSERTIONS for more info."),S?.(o),o}function Te(){return{a:{ma:hb,gb:cb,g:F0,J:H0,f:j0,o:K0,h:Z0,ha:X0,b:Q0,T:Y0,Ha:ch,n:J0,$:gh,Xa:_h,Da:yh,Fa:bh,Ya:wh,Va:$h,Oa:vh,Ua:xh,ka:kh,Ea:Sh,Ba:Th,Wa:zh,Ca:Eh,bb:ey,ea:ty,wa:ry,ua:ny,da:sy,O:oy,H:uy,va:ly,_:gy,xa:_y,Ra:yy,za:wy,Ia:$y,sa:vy,fa:xy,Qa:da,_a:ky,R:Ey,r:Ry,c:ua,hb:By,y:Ny,M:My,D:Dy,l:Py,s:Mh,ib:Uy,I:qy,S:Ly,j:Wy,u:Vy,q:Gy,k:Fy,La:Hy,Ma:jy,Na:Ky,Ja:qh,Ka:Lh,ta:Wh,db:Xy,ab:Yy,v:Jy,aa:eb,ga:tb,$a:Qy,W:rb,Za:ib,Aa:nb,F:Zy,U:ab,la:si,ya:ob,fb:sb,eb:ub,Sa:Hh,Ta:jh,Ga:ia,V:Kh,ja:Zh,Pa:Xh,ia:Qh,kb:Zb,na:Gb,lb:Kb,oa:Vb,G:Bb,e:_b,t:mb,w:fb,B:zb,mb:qb,K:Ab,x:wb,pa:Lb,Y:Fb,ba:Ub,nb:Pb,ob:Db,P:Eb,qa:Mb,pb:Nb,N:Ob,Z:Wb,d:gb,A:bb,m:yb,jb:Xb,p:vb,z:xb,C:$b,E:kb,L:Ib,qb:Rb,Q:Hb,ca:Cb,X:jb,rb:Tb,ra:Sb,i:db,a:bt,cb:ra}}}async function Ce(){function o(h,w){var T=pt=h.exports;h={};for(let[I,B]of Object.entries(T))typeof B=="function"?(T=Sy(B),h[I]=T):h[I]=B;return pt=h,pt=(function(){var I=pt,B=W=>se=>W(se)>>>0,L=W=>()=>W()>>>0;return(I=Object.assign({},I)).tb=B(I.tb),I.Xb=L(I.Xb),I.Zb=B(I.Zb),I.lc=B(I.lc),I.mc=L(I.mc),I.qc=B(I.qc),I})(),nh.push(pt._b),Yh=(h=pt).tb,Jh=h.ub,t._OrtInit=h.vb,t._OrtGetLastError=h.wb,t._OrtCreateSessionOptions=h.xb,t._OrtAppendExecutionProvider=h.yb,t._OrtAddFreeDimensionOverride=h.zb,t._OrtAddSessionConfigEntry=h.Ab,t._OrtReleaseSessionOptions=h.Bb,t._OrtCreateSession=h.Cb,t._OrtReleaseSession=h.Db,t._OrtGetInputOutputCount=h.Eb,t._OrtGetInputOutputMetadata=h.Fb,t._OrtFree=h.Gb,t._OrtCreateTensor=h.Hb,t._OrtGetTensorData=h.Ib,t._OrtReleaseTensor=h.Jb,t._OrtCreateRunOptions=h.Kb,t._OrtAddRunConfigEntry=h.Lb,t._OrtReleaseRunOptions=h.Mb,t._OrtCreateBinding=h.Nb,t._OrtBindInput=h.Ob,t._OrtBindOutput=h.Pb,t._OrtClearBoundOutputs=h.Qb,t._OrtReleaseBinding=h.Rb,t._OrtRunWithBinding=h.Sb,t._OrtRun=h.Tb,t._OrtEndProfiling=h.Ub,t._JsepOutput=h.Vb,t._JsepGetNodeName=h.Wb,oi=h.Xb,nt=t._free=h.Yb,br=t._malloc=h.Zb,ya=h.ac,ef=h.bc,tf=h.cc,rf=h.dc,ba=h.ec,nf=h.fc,af=h.gc,le=h.hc,wr=h.ic,sf=h.jc,oe=h.kc,wa=h.lc,ue=h.mc,of=h.nc,$a=h.oc,uf=h.pc,lf=h.qc,df=h.rc,va=h.sc,pf=h.tc,cf=h.uc,hf=h.vc,ff=h.wc,mf=h.xc,gf=h.yc,_f=h.zc,yf=h.Ac,bf=h.Bc,wf=h.Cc,$f=h.Dc,vf=h.Ec,xf=h.Fc,kf=h.Gc,Sf=h.Hc,Tf=h.Ic,zf=h.Jc,Ef=h.Kc,If=h.Lc,Cf=h.Mc,Af=h.Nc,Of=h.Pc,Rf=h.Qc,Bf=h.$c,Nf=h.ad,Mf=h.fd,Df=h.jd,Pf=h.kd,Uf=h.ld,qf=h.md,Lf=h.nd,Wf=h.od,Vf=h.pd,Gf=h.qd,Ff=h.vd,Hf=h.Td,jf=h.Ud,Kf=h.Vd,Zf=h.Wd,_=w,pt}var p,m=Te();return t.instantiateWasm?new Promise(h=>{t.instantiateWasm(m,(w,T)=>{h(o(w,T))})}):n?o(new WebAssembly.Instance(_,Te()),_):(ae??=t.locateFile?t.locateFile?t.locateFile("ort-wasm-simd-threaded.jsep.wasm",f):f+"ort-wasm-simd-threaded.jsep.wasm":new URL("/assets/ort-wasm-simd-threaded.jsep-DC5y_g6C.wasm",self.location.href).href,p=await(async function(h){var w=ae;if(!g&&!C(w))try{var T=fetch(w,{credentials:"same-origin"});return await WebAssembly.instantiateStreaming(T,h)}catch(I){E(`wasm streaming compile failed: ${I}`),E("falling back to ArrayBuffer instantiation")}return(async function(I,B){try{var L=await(async function(W){if(!g)try{var se=await u(W);return new Uint8Array(se)}catch{}if(W==ae&&g)W=new Uint8Array(g);else{if(!l)throw"both async and sync fetching of the wasm failed";W=l(W)}return W})(I);return await WebAssembly.instantiate(L,B)}catch(W){E(`failed to asynchronously prepare wasm: ${W}`),V(W)}})(w,h)})(m),o(p.instance,p.module))}class $e{name="ExitStatus";constructor(p){this.message=`Program terminated with exit(${p})`,this.status=p}}var Ae=o=>{o.terminate(),o.onmessage=()=>{}},me=[],we=0,Be=null,Xr=o=>{yt.length==0&&(uh(),oh(yt[0]));var p=yt.pop();if(!p)return 6;_r.push(p),Ut[o.Rc]=p,p.Rc=o.Rc;var m={Sc:"run",Md:o.Ld,bd:o.bd,Rc:o.Rc};return p.postMessage(m,o.rd),0},tt=0,ve=(o,p,...m)=>{var h,w=16*m.length,T=ue(),I=wa(w),B=I>>>3;for(h of m)typeof h=="bigint"?((v(),ee)[B++>>>0]=1n,(v(),ee)[B++>>>0]=h):((v(),ee)[B++>>>0]=0n,(v(),J)[B++>>>0]=h);return o=tf(o,0,w,I,p),oe(T),o};function ra(o){if(n)return ve(0,1,o);if(y=o,!(0<tt)){for(var p of _r)Ae(p);for(p of yt)Ae(p);yt=[],_r=[],Ut={},A=!0}d(0,new $e(o))}function ih(o){if(n)return ve(1,0,o);ia(o)}var ia=o=>{if(y=o,n)throw ih(o),"unwind";ra(o)},yt=[],_r=[],nh=[],Ut={},ah=o=>{var p=o.Rc;delete Ut[p],yt.push(o),_r.splice(_r.indexOf(o),1),o.Rc=0,rf(p)};function sh(){nh.forEach(o=>o())}var oh=o=>new Promise(p=>{o.onmessage=w=>{var T=w.data;if(w=T.Sc,T.Zc&&T.Zc!=oi()){var I=Ut[T.Zc];I?I.postMessage(T,T.rd):E(`Internal error! Worker sent a message "${w}" to target pthread ${T.Zc}, but that thread no longer exists!`)}else w==="checkMailbox"?ti():w==="spawnThread"?Xr(T):w==="cleanupThread"?ei(()=>{ah(Ut[T.Nd])}):w==="loaded"?(o.loaded=!0,p(o)):T.target==="setimmediate"?o.postMessage(T):w==="uncaughtException"?o.onerror(T.error):w==="callHandler"?t[T.wd](...T.args):w&&E(`worker sent an unknown command ${w}`)},o.onerror=w=>{throw E(`worker sent an error! ${w.filename}:${w.lineno}: ${w.message}`),w};var m,h=[];for(m of[])t.propertyIsEnumerable(m)&&h.push(m);o.postMessage({Sc:"load",xd:h,Od:bt,Pd:_})});function uh(){var o=new Worker((()=>{let p=URL;return self.location.href>"file:"&&self.location.href<"file;"?new p("ort.bundle.min.mjs",self.location.href):new URL(self.location.href)})(),{type:"module",workerData:"em-pthread",name:"em-pthread"});yt.push(o)}var bt,G0=(o,p)=>{tt=0,o=va(o,p),0<tt?y=o:ba(o)},Qr=[],Yr=0;function F0(o){var p=new na(o>>>=0);return(v(),q)[p.Tc+12>>>0]==0&&(lh(p,!0),Yr--),dh(p,!1),Qr.push(p),lf(o)}var Xt=0,H0=()=>{le(0,0);var o=Qr.pop();of(o.cd),Xt=0};function lh(o,p){p=p?1:0,(v(),q)[o.Tc+12>>>0]=p}function dh(o,p){p=p?1:0,(v(),q)[o.Tc+13>>>0]=p}class na{constructor(p){this.cd=p,this.Tc=p-24}}var aa=o=>{var p=Xt;if(!p)return wr(0),0;var m=new na(p);(v(),M)[m.Tc+16>>>2>>>0]=p;var h=(v(),M)[m.Tc+4>>>2>>>0];if(!h)return wr(0),p;for(var w of o){if(w===0||w===h)break;if(uf(w,h,m.Tc+16))return wr(w),p}return wr(h),p};function j0(){return aa([])}function K0(o){return aa([o>>>0])}function Z0(o,p,m,h){return aa([o>>>0,p>>>0,m>>>0,h>>>0])}var X0=()=>{var o=Qr.pop();o||V("no exception to throw");var p=o.cd;throw(v(),q)[o.Tc+13>>>0]==0&&(Qr.push(o),dh(o,!0),lh(o,!1),Yr++),$a(p),Xt=p};function Q0(o,p,m){var h=new na(o>>>=0);throw p>>>=0,m>>>=0,(v(),M)[h.Tc+16>>>2>>>0]=0,(v(),M)[h.Tc+4>>>2>>>0]=p,(v(),M)[h.Tc+8>>>2>>>0]=m,$a(o),Yr++,Xt=o}var Y0=()=>Yr;function ph(o,p,m,h){return n?ve(2,1,o,p,m,h):ch(o,p,m,h)}function ch(o,p,m,h){if(o>>>=0,p>>>=0,m>>>=0,h>>>=0,!globalThis.SharedArrayBuffer)return 6;var w=[];return n&&w.length===0?ph(o,p,m,h):(o={Ld:m,Rc:o,bd:h,rd:w},n?(o.Sc="spawnThread",postMessage(o,w),0):Xr(o))}function J0(o){throw Xt||=o>>>0,Xt}var hh=globalThis.TextDecoder&&new TextDecoder,fh=(o,p,m,h)=>{if(m=p+m,h)return m;for(;o[p]&&!(p>=m);)++p;return p},mh=(o,p=0,m,h)=>{if(16<(m=fh(o,p>>>=0,m,h))-p&&o.buffer&&hh)return hh.decode(o.buffer instanceof ArrayBuffer?o.subarray(p,m):o.slice(p,m));for(h="";p<m;){var w=o[p++];if(128&w){var T=63&o[p++];if((224&w)==192)h+=String.fromCharCode((31&w)<<6|T);else{var I=63&o[p++];65536>(w=(240&w)==224?(15&w)<<12|T<<6|I:(7&w)<<18|T<<12|I<<6|63&o[p++])?h+=String.fromCharCode(w):(w-=65536,h+=String.fromCharCode(55296|w>>10,56320|1023&w))}}else h+=String.fromCharCode(w)}return h},Se=(o,p,m)=>(o>>>=0)?mh((v(),Q),o,p,m):"";function gh(o,p,m){return n?ve(3,1,o,p,m):0}function _h(o,p){if(n)return ve(4,1,o,p)}function yh(o,p){if(n)return ve(5,1,o,p)}function bh(o,p,m){if(n)return ve(6,1,o,p,m)}function wh(o,p,m){return n?ve(7,1,o,p,m):0}function $h(o,p){if(n)return ve(8,1,o,p)}function vh(o,p,m){if(n)return ve(9,1,o,p,m)}function xh(o,p,m,h){if(n)return ve(10,1,o,p,m,h)}function kh(o,p,m,h){if(n)return ve(11,1,o,p,m,h)}function Sh(o,p,m,h){if(n)return ve(12,1,o,p,m,h)}function Th(o){if(n)return ve(13,1,o)}function zh(o,p){if(n)return ve(14,1,o,p)}function Eh(o,p,m){if(n)return ve(15,1,o,p,m)}var ey=()=>V(""),rt=o=>{o>>>=0;for(var p="";;){var m=(v(),Q)[o++>>>0];if(!m)return p;p+=String.fromCharCode(m)}},sa={},oa={},Qt=class extends Error{constructor(o){super(o),this.name="BindingError"}};function dt(o,p,m={}){return(function(h,w,T={}){var I=w.name;if(!h)throw new Qt(`type "${I}" must have a positive integer typeid pointer`);if(oa.hasOwnProperty(h)){if(T.yd)return;throw new Qt(`Cannot register type '${I}' twice`)}oa[h]=w,sa.hasOwnProperty(h)&&(w=sa[h],delete sa[h],w.forEach(B=>B()))})(o,p,m)}var Ih=(o,p,m)=>{switch(p){case 1:return m?h=>(v(),q)[h>>>0]:h=>(v(),Q)[h>>>0];case 2:return m?h=>(v(),H)[h>>>1>>>0]:h=>(v(),Z)[h>>>1>>>0];case 4:return m?h=>(v(),R)[h>>>2>>>0]:h=>(v(),M)[h>>>2>>>0];case 8:return m?h=>(v(),ee)[h>>>3>>>0]:h=>(v(),re)[h>>>3>>>0];default:throw new TypeError(`invalid integer width (${p}): ${o}`)}};function ty(o,p,m,h,w){o>>>=0,m>>>=0,p=rt(p>>>0);let T=I=>I;if(h=h===0n){let I=8*m;T=B=>BigInt.asUintN(I,B),w=T(w)}dt(o,{name:p,Oc:T,Vc:(I,B)=>(typeof B=="number"&&(B=BigInt(B)),B),Uc:Ih(p,m,!h),Wc:null})}function ry(o,p,m,h){dt(o>>>=0,{name:p=rt(p>>>0),Oc:function(w){return!!w},Vc:function(w,T){return T?m:h},Uc:function(w){return this.Oc((v(),Q)[w>>>0])},Wc:null})}var Ch=[],qt=[0,1,,1,null,1,!0,1,!1,1];function ua(o){9<(o>>>=0)&&--qt[o+1]===0&&(qt[o]=void 0,Ch.push(o))}var Le=o=>{if(!o)throw new Qt(`Cannot use deleted val. handle = ${o}`);return qt[o]},Qe=o=>{switch(o){case void 0:return 2;case null:return 4;case!0:return 6;case!1:return 8;default:let p=Ch.pop()||qt.length;return qt[p]=o,qt[p+1]=1,p}};function la(o){return this.Oc((v(),M)[o>>>2>>>0])}var iy={name:"emscripten::val",Oc:o=>{var p=Le(o);return ua(o),p},Vc:(o,p)=>Qe(p),Uc:la,Wc:null};function ny(o){return dt(o>>>0,iy)}var ay=(o,p)=>{switch(p){case 4:return function(m){return this.Oc((v(),G)[m>>>2>>>0])};case 8:return function(m){return this.Oc((v(),J)[m>>>3>>>0])};default:throw new TypeError(`invalid float width (${p}): ${o}`)}};function sy(o,p,m){m>>>=0,dt(o>>>=0,{name:p=rt(p>>>0),Oc:h=>h,Vc:(h,w)=>w,Uc:ay(p,m),Wc:null})}function oy(o,p,m,h,w){o>>>=0,m>>>=0,p=rt(p>>>0);let T=B=>B;if(h===0){var I=32-8*m;T=B=>B<<I>>>I,w=T(w)}dt(o,{name:p,Oc:T,Vc:(B,L)=>L,Uc:Ih(p,m,h!==0),Wc:null})}function uy(o,p,m){function h(T){var I=(v(),M)[T>>>2>>>0];return T=(v(),M)[T+4>>>2>>>0],new w((v(),q).buffer,T,I)}var w=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array][p];dt(o>>>=0,{name:m=rt(m>>>0),Oc:h,Uc:h},{yd:!0})}var wt=(o,p,m)=>{var h=(v(),Q);if(p>>>=0,0<m){var w=p;m=p+m-1;for(var T=0;T<o.length;++T){var I=o.codePointAt(T);if(127>=I){if(p>=m)break;h[p++>>>0]=I}else if(2047>=I){if(p+1>=m)break;h[p++>>>0]=192|I>>6,h[p++>>>0]=128|63&I}else if(65535>=I){if(p+2>=m)break;h[p++>>>0]=224|I>>12,h[p++>>>0]=128|I>>6&63,h[p++>>>0]=128|63&I}else{if(p+3>=m)break;h[p++>>>0]=240|I>>18,h[p++>>>0]=128|I>>12&63,h[p++>>>0]=128|I>>6&63,h[p++>>>0]=128|63&I,T++}}h[p>>>0]=0,o=p-w}else o=0;return o},Jr=o=>{for(var p=0,m=0;m<o.length;++m){var h=o.charCodeAt(m);127>=h?p++:2047>=h?p+=2:55296<=h&&57343>=h?(p+=4,++m):p+=3}return p};function ly(o,p){dt(o>>>=0,{name:p=rt(p>>>0),Oc(m){var h=(v(),M)[m>>>2>>>0];return h=Se(m+4,h,!0),nt(m),h},Vc(m,h){h instanceof ArrayBuffer&&(h=new Uint8Array(h));var w=typeof h=="string";if(!(w||ArrayBuffer.isView(h)&&h.BYTES_PER_ELEMENT==1))throw new Qt("Cannot pass non-string to std::string");var T=w?Jr(h):h.length,I=br(4+T+1),B=I+4;return(v(),M)[I>>>2>>>0]=T,w?wt(h,B,T+1):(v(),Q).set(h,B>>>0),m!==null&&m.push(nt,I),I},Uc:la,Wc(m){nt(m)}})}var Ah=globalThis.TextDecoder?new TextDecoder("utf-16le"):void 0,dy=(o,p,m)=>{if(o>>>=1,16<(p=fh((v(),Z),o,p/2,m))-o&&Ah)return Ah.decode((v(),Z).slice(o,p));for(m="";o<p;++o){var h=(v(),Z)[o>>>0];m+=String.fromCharCode(h)}return m},py=(o,p,m)=>{if(m??=2147483647,2>m)return 0;var h=p;m=(m-=2)<2*o.length?m/2:o.length;for(var w=0;w<m;++w){var T=o.charCodeAt(w);(v(),H)[p>>>1>>>0]=T,p+=2}return(v(),H)[p>>>1>>>0]=0,p-h},cy=o=>2*o.length,hy=(o,p,m)=>{var h="";o>>>=2;for(var w=0;!(w>=p/4);w++){var T=(v(),M)[o+w>>>0];if(!T&&!m)break;h+=String.fromCodePoint(T)}return h},fy=(o,p,m)=>{if(p>>>=0,m??=2147483647,4>m)return 0;var h=p;m=h+m-4;for(var w=0;w<o.length;++w){var T=o.codePointAt(w);if(65535<T&&w++,(v(),R)[p>>>2>>>0]=T,(p+=4)+4>m)break}return(v(),R)[p>>>2>>>0]=0,p-h},my=o=>{for(var p=0,m=0;m<o.length;++m)65535<o.codePointAt(m)&&m++,p+=4;return p};function gy(o,p,m){if(o>>>=0,p>>>=0,m=rt(m>>>=0),p===2)var h=dy,w=py,T=cy;else h=hy,w=fy,T=my;dt(o,{name:m,Oc:I=>{var B=(v(),M)[I>>>2>>>0];return B=h(I+4,B*p,!0),nt(I),B},Vc:(I,B)=>{if(typeof B!="string")throw new Qt(`Cannot pass non-string to C++ string type ${m}`);var L=T(B),W=br(4+L+p);return(v(),M)[W>>>2>>>0]=L/p,w(B,W+4,L+p),I!==null&&I.push(nt,W),W},Uc:la,Wc(I){nt(I)}})}function _y(o,p){dt(o>>>=0,{zd:!0,name:p=rt(p>>>0),Oc:()=>{},Vc:()=>{}})}function yy(o){ya(o>>>0,!i,1,!r,131072,!1),sh()}var ei=o=>{if(!A)try{if(o(),!(0<tt))try{n?oi()&&ba(y):ia(y)}catch(p){p instanceof $e||p=="unwind"||d(0,p)}}catch(p){p instanceof $e||p=="unwind"||d(0,p)}},by=!Atomics.waitAsync||globalThis.navigator?.userAgent&&91>Number((navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)||[])[2]);function da(o){o>>>=0,by||(Atomics.waitAsync((v(),R),o>>>2,o).value.then(ti),o+=128,Atomics.store((v(),R),o>>>2,1))}var ti=()=>ei(()=>{var o=oi();o&&(da(o),af())});function wy(o,p){(o>>>=0)==p>>>0?setTimeout(ti):n?postMessage({Zc:o,Sc:"checkMailbox"}):(o=Ut[o])&&o.postMessage({Sc:"checkMailbox"})}var pa=[];function $y(o,p,m,h,w){for(p>>>=0,w>>>=0,pa.length=0,m=w>>>3,h=w+h>>>3;m<h;){var T;T=(v(),ee)[m++>>>0]?(v(),ee)[m++>>>0]:(v(),J)[m++>>>0],pa.push(T)}return(p?xa[p]:pb[o])(...pa)}var vy=()=>{tt=0};function xy(o){o>>>=0,n?postMessage({Sc:"cleanupThread",Nd:o}):ah(Ut[o])}function ky(o){}var ri=o=>{try{o()}catch(p){V(p)}};function Sy(o){var p=(...m)=>{ii.push(o);try{return o(...m)}finally{A||(ii.pop(),it&&$t===1&&ii.length===0&&($t=0,tt+=1,ri(jf),typeof Fibers<"u"&&Fibers.Zd()))}};return Bh.set(o,p),p}var $t=0,it=null,Oh=0,ii=[],ca=new Map,Rh=new Map,Bh=new Map,Ty=0,ha=null,zy=[],Nh=o=>(function(p){if(!A){if($t===0){var m=!1,h=!1;p((w=0)=>{if(!A&&(Oh=w,m=!0,h)){$t=2,ri(()=>Kf(it)),typeof MainLoop<"u"&&MainLoop.ud&&MainLoop.resume(),w=!1;try{var T=(function(){var L=(v(),R)[it+8>>>2>>>0];return L=Rh.get(L),L=Bh.get(L),--tt,L()})()}catch(L){T=L,w=!0}var I=!1;if(!it){var B=ha;B&&(ha=null,(w?B.reject:B.resolve)(T),I=!0)}if(w&&!I)throw T}}),h=!0,m||($t=1,it=(function(){var w=br(65548),T=w+12;if((v(),M)[w>>>2>>>0]=T,(v(),M)[w+4>>>2>>>0]=T+65536,T=ii[0],!ca.has(T)){var I=Ty++;ca.set(T,I),Rh.set(I,T)}return T=ca.get(T),(v(),R)[w+8>>>2>>>0]=T,w})(),typeof MainLoop<"u"&&MainLoop.ud&&MainLoop.pause(),ri(()=>Hf(it)))}else $t===2?($t=0,ri(Zf),nt(it),it=null,zy.forEach(ei)):V(`invalid state: ${$t}`);return Oh}})(p=>{o().then(p)});function Ey(o){return o>>>=0,Nh(async()=>{var p=await Le(o);return Qe(p)})}var fa=[],Iy=o=>{var p=fa.length;return fa.push(o),p},Cy=(o,p)=>{for(var m=Array(o),h=0;h<o;++h){var w=h,T=(v(),M)[p+4*h>>>2>>>0],I=oa[T];if(I===void 0)throw o=`parameter ${h}`,T=Yh(T),p=rt(T),nt(T),new Qt(`${o} has unknown type ${p}`);m[w]=I}return m},Ay=(o,p,m)=>{var h=[];return o=o(h,m),h.length&&((v(),M)[p>>>2>>>0]=Qe(h)),o},Oy={},ni=o=>{var p=Oy[o];return p===void 0?rt(o):p};function Ry(o,p,m){var[h,...w]=Cy(o,p>>>0);p=h.Vc.bind(h);var T=w.map(L=>L.Uc.bind(L));o--;var I={toValue:Le};switch(o=T.map((L,W)=>{var se=`argFromPtr${W}`;return I[se]=L,`${se}(args${W?"+"+8*W:""})`}),m){case 0:var B="toValue(handle)";break;case 2:B="new (toValue(handle))";break;case 3:B="";break;case 1:I.getStringOrSymbol=ni,B="toValue(handle)[getStringOrSymbol(methodName)]"}return B+=`(${o})`,h.zd||(I.toReturnWire=p,I.emval_returnValue=Ay,B=`return emval_returnValue(toReturnWire, destructorsRef, ${B})`),B=`return function (handle, methodName, destructorsRef, args) {
  ${B}
  }`,m=new Function(Object.keys(I),B)(...Object.values(I)),B=`methodCaller<(${w.map(L=>L.name)}) => ${h.name}>`,Iy(Object.defineProperty(m,"name",{value:B}))}function By(o,p){return p>>>=0,(o=Le(o>>>0))==Le(p)}function Ny(o){return(o>>>=0)?(o=ni(o),Qe(globalThis[o])):Qe(globalThis)}function My(o){return o=ni(o>>>0),Qe(t[o])}function Dy(o,p){return p>>>=0,o=Le(o>>>0),p=Le(p),Qe(o[p])}function Py(o){9<(o>>>=0)&&(qt[o+1]+=1)}function Mh(o,p,m,h,w){return fa[o>>>0](p>>>0,m>>>0,h>>>0,w>>>0)}function Uy(o,p,m,h,w){return Mh(o>>>0,p>>>0,m>>>0,h>>>0,w>>>0)}function qy(){return Qe([])}function Ly(o){o=Le(o>>>0);for(var p=Array(o.length),m=0;m<o.length;m++)p[m]=o[m];return Qe(p)}function Wy(o){return Qe(ni(o>>>0))}function Vy(){return Qe({})}function Gy(o){for(var p=Le(o>>>=0);p.length;){var m=p.pop();p.pop()(m)}ua(o)}function Fy(o,p,m){p>>>=0,m>>>=0,o=Le(o>>>0),p=Le(p),m=Le(m),o[p]=m}function Hy(o,p){o=-9007199254740992>o||9007199254740992<o?NaN:Number(o),p>>>=0,o=new Date(1e3*o),(v(),R)[p>>>2>>>0]=o.getUTCSeconds(),(v(),R)[p+4>>>2>>>0]=o.getUTCMinutes(),(v(),R)[p+8>>>2>>>0]=o.getUTCHours(),(v(),R)[p+12>>>2>>>0]=o.getUTCDate(),(v(),R)[p+16>>>2>>>0]=o.getUTCMonth(),(v(),R)[p+20>>>2>>>0]=o.getUTCFullYear()-1900,(v(),R)[p+24>>>2>>>0]=o.getUTCDay(),o=(o.getTime()-Date.UTC(o.getUTCFullYear(),0,1,0,0,0,0))/864e5|0,(v(),R)[p+28>>>2>>>0]=o}var Dh=o=>o%4==0&&(o%100!=0||o%400==0),Ph=[0,31,60,91,121,152,182,213,244,274,305,335],Uh=[0,31,59,90,120,151,181,212,243,273,304,334];function jy(o,p){o=-9007199254740992>o||9007199254740992<o?NaN:Number(o),p>>>=0,o=new Date(1e3*o),(v(),R)[p>>>2>>>0]=o.getSeconds(),(v(),R)[p+4>>>2>>>0]=o.getMinutes(),(v(),R)[p+8>>>2>>>0]=o.getHours(),(v(),R)[p+12>>>2>>>0]=o.getDate(),(v(),R)[p+16>>>2>>>0]=o.getMonth(),(v(),R)[p+20>>>2>>>0]=o.getFullYear()-1900,(v(),R)[p+24>>>2>>>0]=o.getDay();var m=(Dh(o.getFullYear())?Ph:Uh)[o.getMonth()]+o.getDate()-1|0;(v(),R)[p+28>>>2>>>0]=m,(v(),R)[p+36>>>2>>>0]=-60*o.getTimezoneOffset(),m=new Date(o.getFullYear(),6,1).getTimezoneOffset();var h=new Date(o.getFullYear(),0,1).getTimezoneOffset();o=0|(m!=h&&o.getTimezoneOffset()==Math.min(h,m)),(v(),R)[p+32>>>2>>>0]=o}function Ky(o){o>>>=0;var p=new Date((v(),R)[o+20>>>2>>>0]+1900,(v(),R)[o+16>>>2>>>0],(v(),R)[o+12>>>2>>>0],(v(),R)[o+8>>>2>>>0],(v(),R)[o+4>>>2>>>0],(v(),R)[o>>>2>>>0],0),m=(v(),R)[o+32>>>2>>>0],h=p.getTimezoneOffset(),w=new Date(p.getFullYear(),6,1).getTimezoneOffset(),T=new Date(p.getFullYear(),0,1).getTimezoneOffset(),I=Math.min(T,w);return 0>m?(v(),R)[o+32>>>2>>>0]=+(w!=T&&I==h):0<m!=(I==h)&&(w=Math.max(T,w),p.setTime(p.getTime()+6e4*((0<m?I:w)-h))),(v(),R)[o+24>>>2>>>0]=p.getDay(),m=(Dh(p.getFullYear())?Ph:Uh)[p.getMonth()]+p.getDate()-1|0,(v(),R)[o+28>>>2>>>0]=m,(v(),R)[o>>>2>>>0]=p.getSeconds(),(v(),R)[o+4>>>2>>>0]=p.getMinutes(),(v(),R)[o+8>>>2>>>0]=p.getHours(),(v(),R)[o+12>>>2>>>0]=p.getDate(),(v(),R)[o+16>>>2>>>0]=p.getMonth(),(v(),R)[o+20>>>2>>>0]=p.getYear(),o=p.getTime(),BigInt(isNaN(o)?-1:o/1e3)}function qh(o,p,m,h,w,T,I){return n?ve(16,1,o,p,m,h,w,T,I):-52}function Lh(o,p,m,h,w,T){if(n)return ve(17,1,o,p,m,h,w,T)}var yr={},Zy=()=>performance.timeOrigin+performance.now();function Wh(o,p){if(n)return ve(18,1,o,p);if(yr[o]&&(clearTimeout(yr[o].id),delete yr[o]),!p)return 0;var m=setTimeout(()=>{delete yr[o],ei(()=>nf(o,performance.timeOrigin+performance.now()))},p);return yr[o]={id:m,Yd:p},0}function Xy(o,p,m,h){o>>>=0,p>>>=0,m>>>=0,h>>>=0;var w=new Date().getFullYear(),T=new Date(w,0,1).getTimezoneOffset();w=new Date(w,6,1).getTimezoneOffset();var I=Math.max(T,w);(v(),M)[o>>>2>>>0]=60*I,(v(),R)[p>>>2>>>0]=+(T!=w),o=(p=B=>{var L=Math.abs(B);return`UTC${0<=B?"-":"+"}${String(Math.floor(L/60)).padStart(2,"0")}${String(L%60).padStart(2,"0")}`})(T),p=p(w),w<T?(wt(o,m,17),wt(p,h,17)):(wt(o,h,17),wt(p,m,17))}var Qy=()=>Date.now();function Yy(o,p,m){return m>>>=0,0<=o&&3>=o?(o===0?o=Date.now():o=performance.timeOrigin+performance.now(),o=Math.round(1e6*o),(v(),ee)[m>>>3>>>0]=BigInt(o),0):28}var ma=[],Vh=(o,p)=>{ma.length=0;for(var m;m=(v(),Q)[o++>>>0];){var h=m!=105;p+=(h&=m!=112)&&p%8?4:0,ma.push(m==112?(v(),M)[p>>>2>>>0]:m==106?(v(),ee)[p>>>3>>>0]:m==105?(v(),R)[p>>>2>>>0]:(v(),J)[p>>>3>>>0]),p+=h?8:4}return ma};function Jy(o,p,m){return o>>>=0,p=Vh(p>>>0,m>>>0),xa[o](...p)}function eb(o,p,m){return o>>>=0,p=Vh(p>>>0,m>>>0),xa[o](...p)}var tb=()=>{};function rb(o,p){return E(Se(o>>>0,p>>>0))}var ib=()=>{throw tt+=1,"unwind"};function nb(){return 4294901760}var ab=()=>navigator.hardwareConcurrency,Lt={},ai=o=>{var p;return(p=/\bwasm-function\[\d+\]:(0x[0-9a-f]+)/.exec(o))?+p[1]:(p=/:(\d+):\d+(?:\)|$)/.exec(o))?2147483648|+p[1]:0},Gh=o=>{for(var p of o)(o=ai(p))&&(Lt[o]=p)};function sb(){var o=Error().stack.toString().split(`
`);return o[0]=="Error"&&o.shift(),Gh(o),Lt.gd=ai(o[3]),Lt.Jd=o,Lt.gd}function si(o){if(!(o=Lt[o>>>0]))return 0;var p;if(p=/^\s+at .*\.wasm\.(.*) \(.*\)$/.exec(o))o=p[1];else if(p=/^\s+at (.*) \(.*\)$/.exec(o))o=p[1];else{if(!(p=/^(.+?)@/.exec(o)))return 0;o=p[1]}nt(si.hd??0),p=Jr(o)+1;var m=br(p);return m&&wt(o,m,p),si.hd=m,si.hd}function ob(o){o>>>=0;var p=(v(),Q).length;if(o<=p||4294901760<o)return!1;for(var m=1;4>=m;m*=2){var h=p*(1+.2/m);h=Math.min(h,o+100663296);e:{h=(Math.min(4294901760,65536*Math.ceil(Math.max(o,h)/65536))-bt.buffer.byteLength+65535)/65536|0;try{bt.grow(h),Y();var w=1;break e}catch{}w=void 0}if(w)return!0}return!1}function ub(o,p,m){if(o>>>=0,p>>>=0,Lt.gd==o)var h=Lt.Jd;else(h=Error().stack.toString().split(`
`))[0]=="Error"&&h.shift(),Gh(h);for(var w=3;h[w]&&ai(h[w])!=o;)++w;for(o=0;o<m&&h[o+w];++o)(v(),R)[p+4*o>>>2>>>0]=ai(h[o+w]);return o}var ga,_a={},Fh=()=>{if(!ga){var o,p={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:(globalThis.navigator?.language??"C").replace("-","_")+".UTF-8",_:"./this.program"};for(o in _a)_a[o]===void 0?delete p[o]:p[o]=_a[o];var m=[];for(o in p)m.push(`${o}=${p[o]}`);ga=m}return ga};function Hh(o,p){if(n)return ve(19,1,o,p);o>>>=0,p>>>=0;var m,h=0,w=0;for(m of Fh()){var T=p+h;(v(),M)[o+w>>>2>>>0]=T,h+=wt(m,T,1/0)+1,w+=4}return 0}function jh(o,p){if(n)return ve(20,1,o,p);o>>>=0,p>>>=0;var m=Fh();for(var h of((v(),M)[o>>>2>>>0]=m.length,o=0,m))o+=Jr(h)+1;return(v(),M)[p>>>2>>>0]=o,0}function Kh(o){return n?ve(21,1,o):52}function Zh(o,p,m,h){return n?ve(22,1,o,p,m,h):52}function Xh(o,p,m,h){return n?ve(23,1,o,p,m,h):70}var lb=[null,[],[]];function Qh(o,p,m,h){if(n)return ve(24,1,o,p,m,h);p>>>=0,m>>>=0,h>>>=0;for(var w=0,T=0;T<m;T++){var I=(v(),M)[p>>>2>>>0],B=(v(),M)[p+4>>>2>>>0];p+=8;for(var L=0;L<B;L++){var W=o,se=(v(),Q)[I+L>>>0],pe=lb[W];se===0||se===10?((W===1?k:E)(mh(pe)),pe.length=0):pe.push(se)}w+=B}return(v(),M)[h>>>2>>>0]=w,0}function db(o){return o>>>0}n||(function(){for(var o=t.numThreads-1;o--;)uh();me.push(async()=>{var p=(async function(){if(!n)return Promise.all(yt.map(oh))})();we++,await p,--we==0&&Be&&(p=Be,Be=null,p())})})(),n||(bt=new WebAssembly.Memory({initial:256,maximum:65536,shared:!0}),Y()),t.wasmBinary&&(g=t.wasmBinary),t.stackSave=()=>ue(),t.stackRestore=o=>oe(o),t.stackAlloc=o=>wa(o),t.setValue=function(o,p,m="i8"){switch(m.endsWith("*")&&(m="*"),m){case"i1":case"i8":(v(),q)[o>>>0]=p;break;case"i16":(v(),H)[o>>>1>>>0]=p;break;case"i32":(v(),R)[o>>>2>>>0]=p;break;case"i64":(v(),ee)[o>>>3>>>0]=BigInt(p);break;case"float":(v(),G)[o>>>2>>>0]=p;break;case"double":(v(),J)[o>>>3>>>0]=p;break;case"*":(v(),M)[o>>>2>>>0]=p;break;default:V(`invalid type for setValue: ${m}`)}},t.getValue=function(o,p="i8"){switch(p.endsWith("*")&&(p="*"),p){case"i1":case"i8":return(v(),q)[o>>>0];case"i16":return(v(),H)[o>>>1>>>0];case"i32":return(v(),R)[o>>>2>>>0];case"i64":return(v(),ee)[o>>>3>>>0];case"float":return(v(),G)[o>>>2>>>0];case"double":return(v(),J)[o>>>3>>>0];case"*":return(v(),M)[o>>>2>>>0];default:V(`invalid type for getValue: ${p}`)}},t.UTF8ToString=Se,t.stringToUTF8=wt,t.lengthBytesUTF8=Jr;var Yh,Jh,oi,nt,br,ya,ef,tf,rf,ba,nf,af,le,wr,sf,oe,wa,ue,of,$a,uf,lf,df,va,pf,cf,hf,ff,mf,gf,_f,yf,bf,wf,$f,vf,xf,kf,Sf,Tf,zf,Ef,If,Cf,Af,Of,Rf,Bf,Nf,Mf,Df,Pf,Uf,qf,Lf,Wf,Vf,Gf,Ff,Hf,jf,Kf,Zf,pt,pb=[ra,ih,ph,gh,_h,yh,bh,wh,$h,vh,xh,kh,Sh,Th,zh,Eh,qh,Lh,Wh,Hh,jh,Kh,Zh,Xh,Qh],xa={1003524:(o,p,m,h,w)=>{if(t===void 0||!t.Xc)return 1;if((o=Se(Number(o>>>0))).startsWith("./")&&(o=o.substring(2)),!(o=t.Xc.get(o)))return 2;if(p=Number(p>>>0),m=Number(m>>>0),h=Number(h>>>0),p+m>o.byteLength)return 3;try{let T=o.subarray(p,p+m);switch(w){case 0:(v(),Q).set(T,h>>>0);break;case 1:t.Qd?t.Qd(h,T):t.Id(h,T);break;default:return 4}return 0}catch{return 4}},1004348:(o,p,m)=>{t.td(o,(v(),Q).subarray(p>>>0,p+m>>>0))},1004412:()=>t.Sd(),1004454:o=>{t.sd(o)},1004491:()=>{t.Bd()},1004522:()=>{t.Cd()},1004551:()=>{t.Gd()},1004576:o=>t.Ad(o),1004609:o=>t.Ed(o),1004641:(o,p,m)=>{t.ed(Number(o),Number(p),Number(m),!0)},1004704:(o,p,m)=>{t.ed(Number(o),Number(p),Number(m))},1004761:()=>typeof wasmOffsetConverter<"u",1004818:o=>{t.$b("Abs",o,void 0)},1004869:o=>{t.$b("Neg",o,void 0)},1004920:o=>{t.$b("Floor",o,void 0)},1004973:o=>{t.$b("Ceil",o,void 0)},1005025:o=>{t.$b("Reciprocal",o,void 0)},1005083:o=>{t.$b("Sqrt",o,void 0)},1005135:o=>{t.$b("Exp",o,void 0)},1005186:o=>{t.$b("Erf",o,void 0)},1005237:o=>{t.$b("Sigmoid",o,void 0)},1005292:(o,p,m)=>{t.$b("HardSigmoid",o,{alpha:p,beta:m})},1005371:o=>{t.$b("Log",o,void 0)},1005422:o=>{t.$b("Sin",o,void 0)},1005473:o=>{t.$b("Cos",o,void 0)},1005524:o=>{t.$b("Tan",o,void 0)},1005575:o=>{t.$b("Asin",o,void 0)},1005627:o=>{t.$b("Acos",o,void 0)},1005679:o=>{t.$b("Atan",o,void 0)},1005731:o=>{t.$b("Sinh",o,void 0)},1005783:o=>{t.$b("Cosh",o,void 0)},1005835:o=>{t.$b("Asinh",o,void 0)},1005888:o=>{t.$b("Acosh",o,void 0)},1005941:o=>{t.$b("Atanh",o,void 0)},1005994:o=>{t.$b("Tanh",o,void 0)},1006046:o=>{t.$b("Not",o,void 0)},1006097:(o,p,m)=>{t.$b("Clip",o,{min:p,max:m})},1006166:o=>{t.$b("Clip",o,void 0)},1006218:(o,p)=>{t.$b("Elu",o,{alpha:p})},1006276:o=>{t.$b("Gelu",o,void 0)},1006328:o=>{t.$b("Relu",o,void 0)},1006380:(o,p)=>{t.$b("LeakyRelu",o,{alpha:p})},1006444:(o,p)=>{t.$b("ThresholdedRelu",o,{alpha:p})},1006514:(o,p)=>{t.$b("Cast",o,{to:p})},1006572:o=>{t.$b("Add",o,void 0)},1006623:o=>{t.$b("Sub",o,void 0)},1006674:o=>{t.$b("Mul",o,void 0)},1006725:o=>{t.$b("Div",o,void 0)},1006776:o=>{t.$b("Pow",o,void 0)},1006827:o=>{t.$b("Equal",o,void 0)},1006880:o=>{t.$b("Greater",o,void 0)},1006935:o=>{t.$b("GreaterOrEqual",o,void 0)},1006997:o=>{t.$b("Less",o,void 0)},1007049:o=>{t.$b("LessOrEqual",o,void 0)},1007108:(o,p,m,h,w)=>{t.$b("ReduceMean",o,{keepDims:!!p,noopWithEmptyAxes:!!m,axes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1007283:(o,p,m,h,w)=>{t.$b("ReduceMax",o,{keepDims:!!p,noopWithEmptyAxes:!!m,axes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1007457:(o,p,m,h,w)=>{t.$b("ReduceMin",o,{keepDims:!!p,noopWithEmptyAxes:!!m,axes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1007631:(o,p,m,h,w)=>{t.$b("ReduceProd",o,{keepDims:!!p,noopWithEmptyAxes:!!m,axes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1007806:(o,p,m,h,w)=>{t.$b("ReduceSum",o,{keepDims:!!p,noopWithEmptyAxes:!!m,axes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1007980:(o,p,m,h,w)=>{t.$b("ReduceL1",o,{keepDims:!!p,noopWithEmptyAxes:!!m,axes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1008153:(o,p,m,h,w)=>{t.$b("ReduceL2",o,{keepDims:!!p,noopWithEmptyAxes:!!m,axes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1008326:(o,p,m,h,w)=>{t.$b("ReduceLogSum",o,{keepDims:!!p,noopWithEmptyAxes:!!m,axes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1008503:(o,p,m,h,w)=>{t.$b("ReduceSumSquare",o,{keepDims:!!p,noopWithEmptyAxes:!!m,axes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1008683:(o,p,m,h,w)=>{t.$b("ReduceLogSumExp",o,{keepDims:!!p,noopWithEmptyAxes:!!m,axes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1008863:o=>{t.$b("Where",o,void 0)},1008916:(o,p,m)=>{t.$b("Transpose",o,{perm:p?Array.from((v(),R).subarray(Number(p)>>>0,Number(m)>>>0)):[]})},1009040:(o,p,m,h)=>{t.$b("DepthToSpace",o,{blocksize:p,mode:Se(m),format:h?"NHWC":"NCHW"})},1009173:(o,p,m,h)=>{t.$b("DepthToSpace",o,{blocksize:p,mode:Se(m),format:h?"NHWC":"NCHW"})},1009306:(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye,vt)=>{t.$b("ConvTranspose",o,{format:L?"NHWC":"NCHW",autoPad:p,dilations:[m],group:h,kernelShape:[w],pads:[T,I],strides:[B],wIsConst:()=>!!(v(),q)[W>>>0],outputPadding:se?Array.from((v(),R).subarray(Number(se)>>>0,Number(pe)>>>0)):[],outputShape:ge?Array.from((v(),R).subarray(Number(ge)>>>0,Number(ye)>>>0)):[],activation:Se(vt)})},1009739:(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye)=>{t.$b("ConvTranspose",o,{format:B?"NHWC":"NCHW",autoPad:p,dilations:Array.from((v(),R).subarray(Number(m)>>>0,(Number(m)>>>0)+2>>>0)),group:h,kernelShape:Array.from((v(),R).subarray(Number(w)>>>0,(Number(w)>>>0)+2>>>0)),pads:Array.from((v(),R).subarray(Number(T)>>>0,(Number(T)>>>0)+4>>>0)),strides:Array.from((v(),R).subarray(Number(I)>>>0,(Number(I)>>>0)+2>>>0)),wIsConst:()=>!!(v(),q)[L>>>0],outputPadding:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],outputShape:pe?Array.from((v(),R).subarray(Number(pe)>>>0,Number(ge)>>>0)):[],activation:Se(ye)})},1010400:(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye,vt)=>{t.$b("ConvTranspose",o,{format:L?"NHWC":"NCHW",autoPad:p,dilations:[m],group:h,kernelShape:[w],pads:[T,I],strides:[B],wIsConst:()=>!!(v(),q)[W>>>0],outputPadding:se?Array.from((v(),R).subarray(Number(se)>>>0,Number(pe)>>>0)):[],outputShape:ge?Array.from((v(),R).subarray(Number(ge)>>>0,Number(ye)>>>0)):[],activation:Se(vt)})},1010833:(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye)=>{t.$b("ConvTranspose",o,{format:B?"NHWC":"NCHW",autoPad:p,dilations:Array.from((v(),R).subarray(Number(m)>>>0,(Number(m)>>>0)+2>>>0)),group:h,kernelShape:Array.from((v(),R).subarray(Number(w)>>>0,(Number(w)>>>0)+2>>>0)),pads:Array.from((v(),R).subarray(Number(T)>>>0,(Number(T)>>>0)+4>>>0)),strides:Array.from((v(),R).subarray(Number(I)>>>0,(Number(I)>>>0)+2>>>0)),wIsConst:()=>!!(v(),q)[L>>>0],outputPadding:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],outputShape:pe?Array.from((v(),R).subarray(Number(pe)>>>0,Number(ge)>>>0)):[],activation:Se(ye)})},1011494:(o,p)=>{t.$b("GlobalAveragePool",o,{format:p?"NHWC":"NCHW"})},1011585:(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye)=>{t.$b("AveragePool",o,{format:ye?"NHWC":"NCHW",auto_pad:p,ceil_mode:m,count_include_pad:h,storage_order:w,dilations:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(I)>>>0)):[],kernel_shape:B?Array.from((v(),R).subarray(Number(B)>>>0,Number(L)>>>0)):[],pads:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],strides:pe?Array.from((v(),R).subarray(Number(pe)>>>0,Number(ge)>>>0)):[]})},1012064:(o,p)=>{t.$b("GlobalAveragePool",o,{format:p?"NHWC":"NCHW"})},1012155:(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye)=>{t.$b("AveragePool",o,{format:ye?"NHWC":"NCHW",auto_pad:p,ceil_mode:m,count_include_pad:h,storage_order:w,dilations:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(I)>>>0)):[],kernel_shape:B?Array.from((v(),R).subarray(Number(B)>>>0,Number(L)>>>0)):[],pads:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],strides:pe?Array.from((v(),R).subarray(Number(pe)>>>0,Number(ge)>>>0)):[]})},1012634:(o,p)=>{t.$b("GlobalMaxPool",o,{format:p?"NHWC":"NCHW"})},1012721:(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye)=>{t.$b("MaxPool",o,{format:ye?"NHWC":"NCHW",auto_pad:p,ceil_mode:m,count_include_pad:h,storage_order:w,dilations:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(I)>>>0)):[],kernel_shape:B?Array.from((v(),R).subarray(Number(B)>>>0,Number(L)>>>0)):[],pads:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],strides:pe?Array.from((v(),R).subarray(Number(pe)>>>0,Number(ge)>>>0)):[]})},1013196:(o,p)=>{t.$b("GlobalMaxPool",o,{format:p?"NHWC":"NCHW"})},1013283:(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye)=>{t.$b("MaxPool",o,{format:ye?"NHWC":"NCHW",auto_pad:p,ceil_mode:m,count_include_pad:h,storage_order:w,dilations:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(I)>>>0)):[],kernel_shape:B?Array.from((v(),R).subarray(Number(B)>>>0,Number(L)>>>0)):[],pads:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],strides:pe?Array.from((v(),R).subarray(Number(pe)>>>0,Number(ge)>>>0)):[]})},1013758:(o,p,m,h,w)=>{t.$b("Gemm",o,{alpha:p,beta:m,transA:h,transB:w})},1013862:o=>{t.$b("MatMul",o,void 0)},1013916:(o,p,m,h)=>{t.$b("ArgMax",o,{keepDims:!!p,selectLastIndex:!!m,axis:h})},1014024:(o,p,m,h)=>{t.$b("ArgMin",o,{keepDims:!!p,selectLastIndex:!!m,axis:h})},1014132:(o,p)=>{t.$b("Softmax",o,{axis:p})},1014195:(o,p)=>{t.$b("Concat",o,{axis:p})},1014255:(o,p,m,h,w)=>{t.$b("Split",o,{axis:p,numOutputs:m,splitSizes:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1014411:o=>{t.$b("Expand",o,void 0)},1014465:(o,p)=>{t.$b("Gather",o,{axis:Number(p)})},1014536:(o,p)=>{t.$b("GatherElements",o,{axis:Number(p)})},1014615:(o,p)=>{t.$b("GatherND",o,{batch_dims:Number(p)})},1014694:(o,p,m,h,w,T,I,B,L,W,se)=>{t.$b("Resize",o,{antialias:p,axes:m?Array.from((v(),R).subarray(Number(m)>>>0,Number(h)>>>0)):[],coordinateTransformMode:Se(w),cubicCoeffA:T,excludeOutside:I,extrapolationValue:B,keepAspectRatioPolicy:Se(L),mode:Se(W),nearestMode:Se(se)})},1015056:(o,p,m,h,w,T,I)=>{t.$b("Slice",o,{starts:p?Array.from((v(),R).subarray(Number(p)>>>0,Number(m)>>>0)):[],ends:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[],axes:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(I)>>>0)):[]})},1015320:o=>{t.$b("Tile",o,void 0)},1015372:(o,p,m)=>{t.$b("InstanceNormalization",o,{epsilon:p,format:m?"NHWC":"NCHW"})},1015486:(o,p,m)=>{t.$b("InstanceNormalization",o,{epsilon:p,format:m?"NHWC":"NCHW"})},1015600:o=>{t.$b("Range",o,void 0)},1015653:(o,p)=>{t.$b("Einsum",o,{equation:Se(p)})},1015734:(o,p,m,h,w)=>{t.$b("Pad",o,{mode:p,value:m,pads:h?Array.from((v(),R).subarray(Number(h)>>>0,Number(w)>>>0)):[]})},1015877:(o,p,m,h,w,T)=>{t.$b("BatchNormalization",o,{epsilon:p,momentum:m,spatial:!!w,trainingMode:!!h,format:T?"NHWC":"NCHW"})},1016046:(o,p,m,h,w,T)=>{t.$b("BatchNormalization",o,{epsilon:p,momentum:m,spatial:!!w,trainingMode:!!h,format:T?"NHWC":"NCHW"})},1016215:(o,p,m)=>{t.$b("CumSum",o,{exclusive:Number(p),reverse:Number(m)})},1016312:(o,p,m)=>{t.$b("DequantizeLinear",o,{axis:p,blockSize:m})},1016402:(o,p,m,h,w)=>{t.$b("GridSample",o,{align_corners:p,mode:Se(m),padding_mode:Se(h),format:w?"NHWC":"NCHW"})},1016572:(o,p,m,h,w)=>{t.$b("GridSample",o,{align_corners:p,mode:Se(m),padding_mode:Se(h),format:w?"NHWC":"NCHW"})},1016742:(o,p)=>{t.$b("ScatterND",o,{reduction:Se(p)})},1016827:(o,p,m,h,w,T,I,B,L)=>{t.$b("Attention",o,{numHeads:p,isUnidirectional:m,maskFilterValue:h,scale:w,doRotary:T,qkvHiddenSizes:I?Array.from((v(),R).subarray(Number(B)>>>0,Number(B)+I>>>0)):[],pastPresentShareBuffer:!!L})},1017099:o=>{t.$b("BiasAdd",o,void 0)},1017154:o=>{t.$b("BiasSplitGelu",o,void 0)},1017215:o=>{t.$b("FastGelu",o,void 0)},1017271:(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye,vt,ka)=>{t.$b("Conv",o,{format:pe?"NHWC":"NCHW",auto_pad:p,dilations:m?Array.from((v(),R).subarray(Number(m)>>>0,Number(h)>>>0)):[],group:w,kernel_shape:T?Array.from((v(),R).subarray(Number(T)>>>0,Number(I)>>>0)):[],pads:B?Array.from((v(),R).subarray(Number(B)>>>0,Number(L)>>>0)):[],strides:W?Array.from((v(),R).subarray(Number(W)>>>0,Number(se)>>>0)):[],w_is_const:()=>!!(v(),q)[Number(ge)>>>0],activation:Se(ye),activation_params:vt?Array.from((v(),G).subarray(Number(vt)>>>0,Number(ka)>>>0)):[]})},1017855:o=>{t.$b("Gelu",o,void 0)},1017907:(o,p,m,h,w,T,I,B,L)=>{t.$b("GroupQueryAttention",o,{numHeads:p,kvNumHeads:m,scale:h,softcap:w,doRotary:T,rotaryInterleaved:I,smoothSoftmax:B,localWindowSize:L})},1018124:(o,p,m,h)=>{t.$b("LayerNormalization",o,{axis:p,epsilon:m,simplified:!!h})},1018235:(o,p,m,h)=>{t.$b("LayerNormalization",o,{axis:p,epsilon:m,simplified:!!h})},1018346:(o,p,m,h,w,T)=>{t.$b("MatMulNBits",o,{k:p,n:m,accuracyLevel:h,bits:w,blockSize:T})},1018473:(o,p,m,h,w,T)=>{t.$b("MultiHeadAttention",o,{numHeads:p,isUnidirectional:m,maskFilterValue:h,scale:w,doRotary:T})},1018632:(o,p)=>{t.$b("QuickGelu",o,{alpha:p})},1018696:(o,p,m,h,w)=>{t.$b("RotaryEmbedding",o,{interleaved:!!p,numHeads:m,rotaryEmbeddingDim:h,scale:w})},1018835:(o,p,m)=>{t.$b("SkipLayerNormalization",o,{epsilon:p,simplified:!!m})},1018937:(o,p,m)=>{t.$b("SkipLayerNormalization",o,{epsilon:p,simplified:!!m})},1019039:(o,p,m,h)=>{t.$b("GatherBlockQuantized",o,{gatherAxis:p,quantizeAxis:m,blockSize:h})},1019160:o=>{t.Fd(o)},1019194:(o,p)=>t.Hd(Number(o),Number(p),t.Yc.Kd,t.Yc.errors)};function cb(o,p,m){return Nh(async()=>{await t.Dd(Number(o),Number(p),Number(m))})}function hb(){return typeof wasmOffsetConverter<"u"}function fb(o,p,m,h){var w=ue();try{return yf(o,p,m,h)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function mb(o,p,m){var h=ue();try{return ff(o,p,m)}catch(w){if(oe(h),w!==w+0)throw w;le(1,0)}}function gb(o){var p=ue();try{pf(o)}catch(m){if(oe(p),m!==m+0)throw m;le(1,0)}}function _b(o,p){var m=ue();try{return va(o,p)}catch(h){if(oe(m),h!==h+0)throw h;le(1,0)}}function yb(o,p,m){var h=ue();try{df(o,p,m)}catch(w){if(oe(h),w!==w+0)throw w;le(1,0)}}function bb(o,p){var m=ue();try{bf(o,p)}catch(h){if(oe(m),h!==h+0)throw h;le(1,0)}}function wb(o,p,m,h,w,T,I){var B=ue();try{return gf(o,p,m,h,w,T,I)}catch(L){if(oe(B),L!==L+0)throw L;le(1,0)}}function $b(o,p,m,h,w,T){var I=ue();try{cf(o,p,m,h,w,T)}catch(B){if(oe(I),B!==B+0)throw B;le(1,0)}}function vb(o,p,m,h){var w=ue();try{_f(o,p,m,h)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function xb(o,p,m,h,w){var T=ue();try{hf(o,p,m,h,w)}catch(I){if(oe(T),I!==I+0)throw I;le(1,0)}}function kb(o,p,m,h,w,T,I){var B=ue();try{$f(o,p,m,h,w,T,I)}catch(L){if(oe(B),L!==L+0)throw L;le(1,0)}}function Sb(o,p,m,h,w,T,I){var B=ue();try{vf(o,p,m,h,w,T,I)}catch(L){if(oe(B),L!==L+0)throw L;le(1,0)}}function Tb(o,p,m,h,w,T,I,B){var L=ue();try{Tf(o,p,m,h,w,T,I,B)}catch(W){if(oe(L),W!==W+0)throw W;le(1,0)}}function zb(o,p,m,h,w){var T=ue();try{return wf(o,p,m,h,w)}catch(I){if(oe(T),I!==I+0)throw I;le(1,0)}}function Eb(o,p,m){var h=ue();try{return zf(o,p,m)}catch(w){if(oe(h),w!==w+0)throw w;le(1,0)}}function Ib(o,p,m,h,w,T,I,B){var L=ue();try{Ef(o,p,m,h,w,T,I,B)}catch(W){if(oe(L),W!==W+0)throw W;le(1,0)}}function Cb(o,p,m,h,w,T,I,B,L,W,se,pe){var ge=ue();try{xf(o,p,m,h,w,T,I,B,L,W,se,pe)}catch(ye){if(oe(ge),ye!==ye+0)throw ye;le(1,0)}}function Ab(o,p,m,h,w,T){var I=ue();try{return kf(o,p,m,h,w,T)}catch(B){if(oe(I),B!==B+0)throw B;le(1,0)}}function Ob(o,p,m){var h=ue();try{return If(o,p,m)}catch(w){if(oe(h),w!==w+0)throw w;return le(1,0),0n}}function Rb(o,p,m,h,w,T,I,B,L){var W=ue();try{mf(o,p,m,h,w,T,I,B,L)}catch(se){if(oe(W),se!==se+0)throw se;le(1,0)}}function Bb(o){var p=ue();try{return Cf(o)}catch(m){if(oe(p),m!==m+0)throw m;le(1,0)}}function Nb(o,p){var m=ue();try{return Ff(o,p)}catch(h){if(oe(m),h!==h+0)throw h;return le(1,0),0n}}function Mb(o){var p=ue();try{return Af(o)}catch(m){if(oe(p),m!==m+0)throw m;return le(1,0),0n}}function Db(o,p,m,h){var w=ue();try{return Df(o,p,m,h)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function Pb(o,p,m,h,w){var T=ue();try{return Pf(o,p,m,h,w)}catch(I){if(oe(T),I!==I+0)throw I;le(1,0)}}function Ub(o,p,m,h,w,T){var I=ue();try{return Uf(o,p,m,h,w,T)}catch(B){if(oe(I),B!==B+0)throw B;le(1,0)}}function qb(o,p,m,h,w,T){var I=ue();try{return qf(o,p,m,h,w,T)}catch(B){if(oe(I),B!==B+0)throw B;le(1,0)}}function Lb(o,p,m,h,w,T,I,B){var L=ue();try{return Sf(o,p,m,h,w,T,I,B)}catch(W){if(oe(L),W!==W+0)throw W;le(1,0)}}function Wb(o,p,m,h,w){var T=ue();try{return Lf(o,p,m,h,w)}catch(I){if(oe(T),I!==I+0)throw I;return le(1,0),0n}}function Vb(o,p,m,h){var w=ue();try{return Wf(o,p,m,h)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function Gb(o,p,m,h){var w=ue();try{return Vf(o,p,m,h)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function Fb(o,p,m,h,w,T,I,B,L,W,se,pe){var ge=ue();try{return Gf(o,p,m,h,w,T,I,B,L,W,se,pe)}catch(ye){if(oe(ge),ye!==ye+0)throw ye;le(1,0)}}function Hb(o,p,m,h,w,T,I,B,L,W,se){var pe=ue();try{Nf(o,p,m,h,w,T,I,B,L,W,se)}catch(ge){if(oe(pe),ge!==ge+0)throw ge;le(1,0)}}function jb(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye,vt,ka){var Qb=ue();try{Mf(o,p,m,h,w,T,I,B,L,W,se,pe,ge,ye,vt,ka)}catch(Sa){if(oe(Qb),Sa!==Sa+0)throw Sa;le(1,0)}}function Kb(o,p,m){var h=ue();try{return Of(o,p,m)}catch(w){if(oe(h),w!==w+0)throw w;le(1,0)}}function Zb(o,p,m){var h=ue();try{return Rf(o,p,m)}catch(w){if(oe(h),w!==w+0)throw w;le(1,0)}}function Xb(o,p,m,h){var w=ue();try{Bf(o,p,m,h)}catch(T){if(oe(w),T!==T+0)throw T;le(1,0)}}function ui(){if(0<we)Be=ui;else if(n)$?.(t),X();else{for(var o=me;0<o.length;)o.shift()(t);0<we?Be=ui:(t.calledRun=!0,A||(X(),$?.(t)))}}return n||(pt=await Ce(),ui()),t.PTR_SIZE=4,P?t:new Promise((o,p)=>{$=o,S=p})}var os,us,A_=U(()=>{os=ss,us=globalThis.self?.name?.startsWith("em-pthread"),us&&ss()}),vi,xi,ls,De,ds,Er,ps,cs,ki,hs,Si,fs,Ti,ms,zi=U(()=>{bi(),vi=typeof location>"u"?void 0:location.origin,xi=self.location.href>"file:"&&self.location.href<"file;",ls=()=>{{if(xi){let e=URL;return new URL(new e("ort.bundle.min.mjs",self.location.href).href,vi).href}return self.location.href}},De=ls(),ds=()=>{if(De&&!De.startsWith("blob:"))return De.substring(0,De.lastIndexOf("/")+1)},Er=(e,t)=>{try{let r=t??De;return(r?new URL(e,r):new URL(e)).origin===vi}catch{return!1}},ps=(e,t)=>{let r=t??De;try{return(r?new URL(e,r):new URL(e)).href}catch{return}},cs=(e,t)=>`${t??"./"}${e}`,ki=async e=>{let t=await(await fetch(e,{credentials:"same-origin"})).blob();return URL.createObjectURL(t)},hs=async e=>(await import(e)).default,Si=(C_(),er(is)).default,fs=async()=>{if(!De)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(Er(De))return[void 0,Si()];let e=await ki(De);return[e,Si(e)]},Ti=(A_(),er(as)).default,ms=async(e,t,r,i)=>{let n=Ti&&!(e||t);if(n)if(De)n=Er(De)||i&&!r;else if(i&&!r)n=!0;else throw new Error("cannot determine the script source URL.");if(n)return[void 0,Ti];{let a="ort-wasm-simd-threaded.jsep.mjs",s=e??ps(a,t),u=r&&s&&!Er(s,t),l=u?await ki(s):s??cs(a,t);return[u?l:void 0,await hs(l)]}}}),Ei,Ir,ir,Ii,gs,_s,ys,Ci,_e,Tt=U(()=>{zi(),Ir=!1,ir=!1,Ii=!1,gs=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},_s=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},ys=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},Ci=async e=>{if(Ir)return Promise.resolve();if(ir)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(Ii)throw new Error("previous call to 'initializeWebAssembly()' failed.");ir=!0;let t=e.initTimeout,r=e.numThreads;if(e.simd!==!1){if(e.simd==="relaxed"){if(!ys())throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.")}else if(!_s())throw new Error("WebAssembly SIMD is not supported in the current environment.")}let i=gs();r>1&&!i&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+r+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),e.numThreads=r=1);let n=e.wasmPaths,a=typeof n=="string"?n:void 0,s=n?.mjs,u=s?.href??s,l=n?.wasm,d=l?.href??l,c=e.wasmBinary,[f,g]=await ms(u,a,r>1,!!c||!!d),_=!1,y=[];if(t>0&&y.push(new Promise($=>{setTimeout(()=>{_=!0,$()},t)})),y.push(new Promise(($,S)=>{let x={numThreads:r};if(c)x.wasmBinary=c,x.locateFile=b=>b;else if(d||a)x.locateFile=b=>d??a+b;else if(u&&u.indexOf("blob:")!==0)x.locateFile=b=>new URL(b,u).href;else if(f){let b=ds();b&&(x.locateFile=z=>b+z)}g(x).then(b=>{ir=!1,Ir=!0,Ei=b,$(),f&&URL.revokeObjectURL(f)},b=>{ir=!1,Ii=!0,S(b)})})),await Promise.race(y),_)throw new Error(`WebAssembly backend initializing failed due to timeout: ${t}ms`)},_e=()=>{if(Ir&&Ei)return Ei;throw new Error("WebAssembly is not initialized yet.")}}),Fe,Cr,fe,Ai=U(()=>{Tt(),Fe=(e,t)=>{let r=_e(),i=r.lengthBytesUTF8(e)+1,n=r._malloc(i);return r.stringToUTF8(e,n,i),t.push(n),n},Cr=(e,t,r,i)=>{if(typeof e=="object"&&e!==null){if(r.has(e))throw new Error("Circular reference in options");r.add(e)}Object.entries(e).forEach(([n,a])=>{let s=t?t+n:n;if(typeof a=="object")Cr(a,s+".",r,i);else if(typeof a=="string"||typeof a=="number")i(s,a.toString());else if(typeof a=="boolean")i(s,a?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof a}`)})},fe=e=>{let t=_e(),r=t.stackSave();try{let i=t.PTR_SIZE,n=t.stackAlloc(2*i);t._OrtGetLastError(n,n+i);let a=Number(t.getValue(n,i===4?"i32":"i64")),s=t.getValue(n+i,"*"),u=s?t.UTF8ToString(s):"";throw new Error(`${e} ERROR_CODE: ${a}, ERROR_MESSAGE: ${u}`)}finally{t.stackRestore(r)}}}),bs,O_=U(()=>{Tt(),Ai(),bs=e=>{let t=_e(),r=0,i=[],n=e||{};try{if(e?.logSeverityLevel===void 0)n.logSeverityLevel=2;else if(typeof e.logSeverityLevel!="number"||!Number.isInteger(e.logSeverityLevel)||e.logSeverityLevel<0||e.logSeverityLevel>4)throw new Error(`log severity level is not valid: ${e.logSeverityLevel}`);if(e?.logVerbosityLevel===void 0)n.logVerbosityLevel=0;else if(typeof e.logVerbosityLevel!="number"||!Number.isInteger(e.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);e?.terminate===void 0&&(n.terminate=!1);let a=0;return e?.tag!==void 0&&(a=Fe(e.tag,i)),r=t._OrtCreateRunOptions(n.logSeverityLevel,n.logVerbosityLevel,!!n.terminate,a),r===0&&fe("Can't create run options."),e?.extra!==void 0&&Cr(e.extra,"",new WeakSet,(s,u)=>{let l=Fe(s,i),d=Fe(u,i);t._OrtAddRunConfigEntry(r,l,d)!==0&&fe(`Can't set a run config entry: ${s} - ${u}.`)}),[r,i]}catch(a){throw r!==0&&t._OrtReleaseRunOptions(r),i.forEach(s=>t._free(s)),a}}}),ws,$s,vs,zt,xs,ks,R_=U(()=>{Tt(),Ai(),ws=e=>{switch(e){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"layout":return 3;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${e}`)}},$s=e=>{switch(e){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${e}`)}},vs=e=>{e.extra||(e.extra={}),e.extra.session||(e.extra.session={});let t=e.extra.session;t.use_ort_model_bytes_directly||(t.use_ort_model_bytes_directly="1"),e.executionProviders&&e.executionProviders.some(r=>(typeof r=="string"?r:r.name)==="webgpu")&&(e.enableMemPattern=!1)},zt=(e,t,r,i)=>{let n=Fe(t,i),a=Fe(r,i);_e()._OrtAddSessionConfigEntry(e,n,a)!==0&&fe(`Can't set a session config entry: ${t} - ${r}.`)},xs=async(e,t,r)=>{let i=t.executionProviders;for(let n of i){let a=typeof n=="string"?n:n.name,s=[];switch(a){case"webnn":if(a="WEBNN",zt(e,"session.disable_quant_qdq","1",r),zt(e,"session.disable_qdq_constant_folding","1",r),typeof n!="string"){let f=n?.deviceType;f&&zt(e,"deviceType",f,r)}break;case"webgpu":if(a="JS",typeof n!="string"){let f=n;if(f?.preferredLayout){if(f.preferredLayout!=="NCHW"&&f.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${f.preferredLayout}`);zt(e,"preferredLayout",f.preferredLayout,r)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${a}`)}let u=Fe(a,r),l=s.length,d=0,c=0;if(l>0){d=_e()._malloc(l*_e().PTR_SIZE),r.push(d),c=_e()._malloc(l*_e().PTR_SIZE),r.push(c);for(let f=0;f<l;f++)_e().setValue(d+f*_e().PTR_SIZE,s[f][0],"*"),_e().setValue(c+f*_e().PTR_SIZE,s[f][1],"*")}await _e()._OrtAppendExecutionProvider(e,u,d,c,l)!==0&&fe(`Can't append execution provider: ${a}.`)}},ks=async e=>{let t=_e(),r=0,i=[],n=e||{};vs(n);try{let a=ws(n.graphOptimizationLevel??"all"),s=$s(n.executionMode??"sequential"),u=typeof n.logId=="string"?Fe(n.logId,i):0,l=n.logSeverityLevel??2;if(!Number.isInteger(l)||l<0||l>4)throw new Error(`log severity level is not valid: ${l}`);let d=n.logVerbosityLevel??0;if(!Number.isInteger(d)||d<0||d>4)throw new Error(`log verbosity level is not valid: ${d}`);let c=typeof n.optimizedModelFilePath=="string"?Fe(n.optimizedModelFilePath,i):0;if(r=t._OrtCreateSessionOptions(a,!!n.enableCpuMemArena,!!n.enableMemPattern,s,!!n.enableProfiling,0,u,l,d,c),r===0&&fe("Can't create session options."),n.executionProviders&&await xs(r,n,i),n.enableGraphCapture!==void 0){if(typeof n.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${n.enableGraphCapture}`);zt(r,"enableGraphCapture",n.enableGraphCapture.toString(),i)}if(n.freeDimensionOverrides)for(let[f,g]of Object.entries(n.freeDimensionOverrides)){if(typeof f!="string")throw new Error(`free dimension override name must be a string: ${f}`);if(typeof g!="number"||!Number.isInteger(g)||g<0)throw new Error(`free dimension override value must be a non-negative integer: ${g}`);let _=Fe(f,i);t._OrtAddFreeDimensionOverride(r,_,g)!==0&&fe(`Can't set a free dimension override: ${f} - ${g}.`)}return n.extra!==void 0&&Cr(n.extra,"",new WeakSet,(f,g)=>{zt(r,f,g,i)}),[r,i]}catch(a){throw r!==0&&t._OrtReleaseSessionOptions(r)!==0&&fe("Can't release session options."),i.forEach(s=>t._free(s)),a}}}),Et,st,It,Ar,Or,Oi,Ri,Bi,te=U(()=>{Et=e=>{switch(e){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${e}`)}},st=e=>{switch(e){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${e}`)}},It=(e,t)=>{let r=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][e],i=typeof t=="number"?t:t.reduce((n,a)=>n*a,1);return r>0?Math.ceil(i*r):void 0},Ar=e=>{switch(e){case"float16":return typeof Float16Array<"u"?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${e}`)}},Or=e=>{switch(e){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${e}`)}},Oi=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",Ri=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint64"||e==="int8"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",Bi=e=>{switch(e){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${e}`)}}}),Ni,Ss=U(()=>{bi(),Ni=async e=>{if(typeof e=="string"){let t=await fetch(e);if(!t.ok)throw new Error(`failed to load external data file: ${e}`);let r=t.headers.get("Content-Length"),i=r?parseInt(r,10):0;if(i<1073741824)return new Uint8Array(await t.arrayBuffer());{if(!t.body)throw new Error(`failed to load external data file: ${e}, no response body.`);let n=t.body.getReader(),a;try{a=new ArrayBuffer(i)}catch(u){if(u instanceof RangeError){let l=Math.ceil(i/65536);a=new WebAssembly.Memory({initial:l,maximum:l}).buffer}else throw u}let s=0;for(;;){let{done:u,value:l}=await n.read();if(u)break;let d=l.byteLength;new Uint8Array(a,s,d).set(l),s+=d}return new Uint8Array(a,0,i)}}else return e instanceof Blob?new Uint8Array(await e.arrayBuffer()):e instanceof Uint8Array?e:new Uint8Array(e)}}),Ts,zs,Es,Is,Mi,Cs,de,ot=U(()=>{te(),Ts=["V","I","W","E","F"],zs=(e,t)=>{console.log(`[${Ts[e]},${new Date().toISOString()}]${t}`)},Mi=(e,t)=>{Es=e,Is=t},Cs=(e,t)=>{let r=Or(e),i=Or(Es);r>=i&&zs(r,typeof t=="function"?t():t)},de=(...e)=>{Is&&Cs(...e)}}),As,Gt,O,Rr,Os,Rs,Bs,ie=U(()=>{As=class{static calcMatMulShape(e,t){return e[1]!==t[0]?void 0:[e[0],t[1]]}},Gt=class{static calcShape(e,t,r=!1){let i=e.length,n=t.length;if(i===0)return t;if(n===0)return e;let a=Math.max(e.length,t.length),s=new Array(a);if(r){if(i<2||n<2)return;let u=As.calcMatMulShape([e[i-2],e[i-1]],[t[n-2],t[n-1]]);if(u===void 0)return;[s[a-2],s[a-1]]=u}for(let u=r?3:1;u<=a;u++){let l=i-u<0?1:e[i-u],d=n-u<0?1:t[n-u];if(l!==d&&l>1&&d>1)return;let c=Math.max(l,d);if(l&&d)s[a-u]=Math.max(l,d);else{if(c>1)return;s[a-u]=0}}return s}static isValidBroadcast(e,t){let r=e.length,i=t.length;if(r>i)return!1;for(let n=1;n<=r;n++)if(e[r-n]!==1&&e[r-n]!==t[i-n])return!1;return!0}},O=class li{static size(t){return li.getSizeFromDimensionRange(t,0,t.length)}static convertShape(t,r=4){let i=t.length;if(i===0)return[];let n=new Array(i),a=i-1;for(;a>=0;){if(t[a]%r===0){n[a]=t[a]/r;break}if(r%t[a]!==0)throw new Error("cannot convert shape");n[a]=1,r/=t[a],a--}for(a--;a>=0;a--)n[a]=t[a];return n}static sizeFromDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeFromDimension as Tensor has ${t.length} dimensions.`);return li.getSizeFromDimensionRange(t,r,t.length)}static sizeToDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeToDimension as Tensor has ${t.length} dimensions.`);return li.getSizeFromDimensionRange(t,0,r)}static getSizeFromDimensionRange(t,r,i){let n=1;for(let a=r;a<i;a++){if(t[a]<0)throw new Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");n*=Number(t[a])}return n}static computeStrides(t){let r=t.length;if(r===0)return[];if(r===1)return[1];let i=new Array(r);i[r-1]=1,i[r-2]=t[r-1];for(let n=r-3;n>=0;--n)i[n]=i[n+1]*t[n+1];return i}static normalizeAxis(t,r){if(t<-r&&t>=r)throw new Error("unsupported axis for this operation.");return t<0?t+r:t}static normalizeAxes(t,r){return t.map(i=>this.normalizeAxis(i,r??t.length))}static sortBasedOnPerm(t,r){return r?r.map(i=>t[i]):t.slice().reverse()}static padShape(t,r){let i=t.length;return t.map((n,a)=>n+r[a]+r[a+i])}static areEqual(t,r){return t.length!==r.length?!1:t.every((i,n)=>i===r[n])}},Rr=class $r{static adjustPoolAttributes(t,r,i,n,a,s){if(!t&&i.length!==r.length-2)throw new Error("length of specified kernel shapes should be 2 less than length of input dimensions");if(t)for(let u=0;u<r.length-2;u++)u>=i.length?i.push(r[u+2]):i[u]=r[u+2];for(let u=0;u<i.length;u++)if(u<n.length){if(n[u]<0)throw new Error("strides should be greater than or equal to 1")}else n.push(1);for(let u=0;u<i.length;u++)if(u<a.length){if(a[u]<0)throw new Error("dilations should be greater than or equal to 1")}else a.push(1);for(let u=0;u<i.length*2;u++)if(u<s.length){if(s[u]<0)throw new Error("pad should be greater than or equal to 1")}else s.push(0);for(let u=0;u<i.length;u++){if(i[u]<=0)throw new Error("kernel shapes need to be greater than 0");if(s[u]>=i[u]||s[u+i.length]>=i[u])throw new Error("pads should be smaller than kernel")}}static adjustPadsBasedOnAutoPad(t,r,i,n,a,s,u){if(u){if(a.length!==2*(t.length-2))throw new Error("length of pads should be twice the length of data dimensions");if(r.length!==t.length-2)throw new Error("length of strides should be the length of data dimensions");if(n.length!==t.length-2)throw new Error("length of kernel shapes should be the length of data dimensions");for(let l=0;l<t.length-2;l++)$r.adjustPadAndReturnShape(t[l+(s?1:2)],r[l],i[l],n[l],a,l,l+t.length-2,u)}}static computePoolOutputShape(t,r,i,n,a,s,u){if(r.length<=0)throw new Error("input shape must be of size greater than 0");let l=[r[0],r[1]];return $r.computeShapeHelper(t,r,l,i,n,a,s,u),l}static computeConvOutputShape(t,r,i,n,a,s,u){if(t.length<=0||r.length<=0)throw new Error("invalid input tensor dims or invalid filter tensor dims");let l=[t[0],r[0]];return $r.computeShapeHelper(!1,t,l,i,n,a,s,u),l}static computeShapeHelper(t,r,i,n,a,s,u,l){if(t)for(let d=0;d<r.length-2;d++)i.push(1);else for(let d=0;d<r.length-2;d++)i.push($r.adjustPadAndReturnShape(r[d+2],n[d],a[d],s[d],u,d,d+r.length-2,l))}static adjustPadAndReturnShape(t,r,i,n,a,s,u,l){let d=i*(n-1)+1;if(l&&l!=="NOTSET")switch(l){case"VALID":return a[s]=0,a[u]=0,Math.floor((t-d)/r+1);case"SAME_LOWER":case"SAME_UPPER":if(i!==1)throw new Error("Dilation not supported for SAME_UPPER or SAME_LOWER");{let c=((t+r-1)/r-1)*r+n-t;return a[s]=Math.floor(l==="SAME_LOWER"?(c+1)/2:c/2),a[u]=c-a[s],Math.floor((t+c-n)/r+1)}default:throw new Error("Unsupported AutoPad type")}else return Math.floor((t+a[s]+a[u]-d)/r+1)}},Os=class{static getShapeOfGemmResult(e,t,r,i,n){if(e.length!==2||r.length!==2)throw new Error("shape need to be of size 2");let a,s,u;t?(a=e[1],s=e[0]):(a=e[0],s=e[1]);let l=-1;if(i?(u=r[0],l=1):(u=r[1],l=0),r[l]!==s)throw new Error("dimension mismatch");if(a<=0||u<=0||s<=0)throw new Error("invalid shape specified");if(n&&!Gt.isValidBroadcast(n,[a,u]))throw new Error("gemm: invalid bias shape for broadcast");return[a,u,s]}},Rs=-34028234663852886e22,Bs=34028234663852886e22}),Di,Ns=U(()=>{te(),Di=(e,t)=>new(Ar(t))(e)}),Pi,Ui,qi,Ms,Li,Ds,Wi,Vi,Gi,Ps,Us,B_=U(()=>{te(),ot(),Pi=new Map([["float32",32],["float16",16],["int32",32],["uint32",32],["int64",64],["uint64",64],["int8",8],["uint8",8],["int4",4],["uint4",4]]),Ui=(e,t)=>{if(t==="int32")return e;let r=Pi.get(t);if(!r)throw new Error(`WebNN backend does not support data type: ${t}`);let i=r/8;if(e.byteLength%i!==0)throw new Error(`Invalid Uint8Array length - must be a multiple of ${i}.`);let n=e.byteLength/i,a=new(Ar(t))(e.buffer,e.byteOffset,n);switch(t){case"int64":case"uint64":{let s=new Int32Array(n);for(let u=0;u<n;u++){let l=a[u];if(l>2147483647n||l<-2147483648n)throw new Error("Can not convert int64 data to int32 - value out of range.");s[u]=Number(l)}return new Uint8Array(s.buffer)}case"int8":case"uint8":case"uint32":{if(t==="uint32"&&a.some(u=>u>2147483647))throw new Error("Can not convert uint32 data to int32 - value out of range.");let s=Int32Array.from(a,Number);return new Uint8Array(s.buffer)}default:throw new Error(`Unsupported data conversion from ${t} to 'int32'`)}},qi=(e,t)=>{if(t==="int32")return e;if(e.byteLength%4!==0)throw new Error("Invalid Uint8Array length - must be a multiple of 4 (int32).");let r=e.byteLength/4,i=new Int32Array(e.buffer,e.byteOffset,r);switch(t){case"int64":{let n=BigInt64Array.from(i,BigInt);return new Uint8Array(n.buffer)}case"uint64":{if(i.some(a=>a<0))throw new Error("Can not convert int32 data to uin64 - negative value found.");let n=BigUint64Array.from(i,BigInt);return new Uint8Array(n.buffer)}case"int8":{if(i.some(a=>a<-128||a>127))throw new Error("Can not convert int32 data to int8 - value out of range.");let n=Int8Array.from(i,Number);return new Uint8Array(n.buffer)}case"uint8":{if(i.some(n=>n<0||n>255))throw new Error("Can not convert int32 data to uint8 - value out of range.");return Uint8Array.from(i,Number)}case"uint32":{if(i.some(a=>a<0))throw new Error("Can not convert int32 data to uint32 - negative value found.");let n=Uint32Array.from(i,Number);return new Uint8Array(n.buffer)}default:throw new Error(`Unsupported data conversion from 'int32' to ${t}`)}},Ms=1,Li=()=>Ms++,Ds=new Map([["int8","int32"],["uint8","int32"],["uint32","int32"],["int64","int32"]]),Wi=(e,t)=>{let r=Pi.get(e);if(!r)throw new Error(`WebNN backend does not support data type: ${e}`);return t.length>0?Math.ceil(t.reduce((i,n)=>i*n)*r/8):0},Vi=class{constructor(e){this.isDataConverted=!1;let{sessionId:t,context:r,tensor:i,dataType:n,shape:a,fallbackDataType:s}=e;this.sessionId=t,this.mlContext=r,this.mlTensor=i,this.dataType=n,this.tensorShape=a,this.fallbackDataType=s}get tensor(){return this.mlTensor}get type(){return this.dataType}get fallbackType(){return this.fallbackDataType}get shape(){return this.tensorShape}get byteLength(){return Wi(this.dataType,this.tensorShape)}destroy(){de("verbose",()=>"[WebNN] TensorWrapper.destroy"),this.mlTensor.destroy()}write(e){this.mlContext.writeTensor(this.mlTensor,e)}async read(e){if(this.fallbackDataType){let t=await this.mlContext.readTensor(this.mlTensor),r=qi(new Uint8Array(t),this.dataType);if(e){(e instanceof ArrayBuffer?new Uint8Array(e):new Uint8Array(e.buffer,e.byteOffset,e.byteLength)).set(r);return}else return new Uint8Array(r).buffer}else return e?this.mlContext.readTensor(this.mlTensor,e):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(e,t,r){return this.mlContext===e&&this.dataType===t&&this.tensorShape.length===r.length&&this.tensorShape.every((i,n)=>i===r[n])}setIsDataConverted(e){this.isDataConverted=e}},Gi=class{constructor(e,t){this.tensorManager=e,this.wrapper=t}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(e,t,r,i){let n=this.tensorManager.getMLContext(e),a=this.tensorManager.getMLOpSupportLimits(e),s;if(!a?.input.dataTypes.includes(t)){if(s=Ds.get(t),!s||a?.input.dataTypes.includes(s))throw new Error(`WebNN backend does not support data type: ${t}`);de("verbose",()=>`[WebNN] TensorIdTracker.ensureTensor: fallback dataType from ${t} to ${s}`)}if(this.wrapper){if(this.wrapper.canReuseTensor(n,t,r))return this.wrapper.tensor;if(i){if(this.wrapper.byteLength!==Wi(t,r))throw new Error("Unable to copy data to tensor with different size.");this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let u=typeof MLTensorUsage>"u"?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(e,t,r,u,!0,!0,s),i&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(e){let t=e;if(this.wrapper){if(this.wrapper.fallbackType)if(this.wrapper.fallbackType==="int32")t=Ui(e,this.wrapper.type),this.wrapper.setIsDataConverted(!0);else throw new Error(`Unsupported fallback data type: ${this.wrapper.fallbackType}`);if(e.byteLength===this.wrapper.byteLength){this.wrapper.write(t);return}else de("verbose",()=>"Data size does not match tensor size. Releasing tensor."),this.releaseTensor()}this.activeUpload?this.activeUpload.set(t):this.activeUpload=new Uint8Array(t)}async download(e){if(this.activeUpload){let t=this.wrapper?.isDataConverted?qi(this.activeUpload,this.wrapper?.type):this.activeUpload;if(e){e instanceof ArrayBuffer?new Uint8Array(e).set(t):new Uint8Array(e.buffer,e.byteOffset,e.byteLength).set(t);return}else return t.buffer}if(!this.wrapper)throw new Error("Tensor has not been created.");return e?this.wrapper.read(e):this.wrapper.read()}},Ps=class{constructor(e){this.backend=e,this.tensorTrackersById=new Map,this.freeTensors=[],this.externalTensors=new Set}getMLContext(e){let t=this.backend.getMLContext(e);if(!t)throw new Error("MLContext not found for session.");return t}getMLOpSupportLimits(e){return this.backend.getMLOpSupportLimits(e)}reserveTensorId(){let e=Li();return this.tensorTrackersById.set(e,new Gi(this)),e}releaseTensorId(e){let t=this.tensorTrackersById.get(e);t&&(this.tensorTrackersById.delete(e),t.tensorWrapper&&this.releaseTensor(t.tensorWrapper))}async ensureTensor(e,t,r,i,n){de("verbose",()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${t}, dataType: ${r}, shape: ${i}, copyOld: ${n}}`);let a=this.tensorTrackersById.get(t);if(!a)throw new Error("Tensor not found.");return a.ensureTensor(e,r,i,n)}upload(e,t){let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");r.upload(t)}async download(e,t){de("verbose",()=>`[WebNN] TensorManager.download {tensorId: ${e}, dstBuffer: ${t?.byteLength}}`);let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");return r.download(t)}releaseTensorsForSession(e){for(let t of this.freeTensors)t.sessionId===e&&t.destroy();this.freeTensors=this.freeTensors.filter(t=>t.sessionId!==e)}registerTensor(e,t,r,i){let n=this.getMLContext(e),a=Li(),s=new Vi({sessionId:e,context:n,tensor:t,dataType:r,shape:i});return this.tensorTrackersById.set(a,new Gi(this,s)),this.externalTensors.add(s),a}async getCachedTensor(e,t,r,i,n,a,s){let u=this.getMLContext(e);for(let[d,c]of this.freeTensors.entries())if(c.canReuseTensor(u,t,r)){de("verbose",()=>`[WebNN] Reusing tensor {dataType: ${t}, ${s?`fallbackDataType: ${s},`:""} shape: ${r}`);let f=this.freeTensors.splice(d,1)[0];return f.sessionId=e,f}de("verbose",()=>`[WebNN] MLContext.createTensor {dataType: ${t}, ${s?`fallbackDataType: ${s},`:""} shape: ${r}}`);let l=await u.createTensor({dataType:s??t,shape:r,dimensions:r,usage:i,writable:n,readable:a});return new Vi({sessionId:e,context:u,tensor:l,dataType:t,shape:r,fallbackDataType:s})}releaseTensor(e){this.externalTensors.has(e)&&this.externalTensors.delete(e),this.freeTensors.push(e)}},Us=(...e)=>new Ps(...e)}),nr,qs,Ls,N_=U(()=>{te(),Tt(),Ns(),B_(),ot(),nr=new Map([[1,"float32"],[10,"float16"],[6,"int32"],[12,"uint32"],[7,"int64"],[13,"uint64"],[22,"int4"],[21,"uint4"],[3,"int8"],[2,"uint8"],[9,"uint8"]]),qs=(e,t)=>{if(e===t)return!0;if(e===void 0||t===void 0)return!1;let r=Object.keys(e).sort(),i=Object.keys(t).sort();return r.length===i.length&&r.every((n,a)=>n===i[a]&&e[n]===t[n])},Ls=class{constructor(e){this.tensorManager=Us(this),this.mlContextBySessionId=new Map,this.sessionIdsByMLContext=new Map,this.mlContextCache=[],this.sessionGraphInputs=new Map,this.sessionGraphOutputs=new Map,this.temporaryGraphInputs=[],this.temporaryGraphOutputs=[],this.temporarySessionTensorIds=new Map,this.mlOpSupportLimitsBySessionId=new Map,Mi(e.logLevel,!!e.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw new Error("No active session");return this.activeSessionId}onRunStart(e){de("verbose",()=>`[WebNN] onRunStart {sessionId: ${e}}`),this.activeSessionId=e}onRunEnd(e){de("verbose",()=>`[WebNN] onRunEnd {sessionId: ${e}}`);let t=this.temporarySessionTensorIds.get(e);if(t){for(let r of t)de("verbose",()=>`[WebNN] releasing temporary tensor {tensorId: ${r}}`),this.tensorManager.releaseTensorId(r);this.temporarySessionTensorIds.delete(e),this.activeSessionId=void 0}}async createMLContext(e){if(e instanceof GPUDevice){let r=this.mlContextCache.findIndex(i=>i.gpuDevice===e);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext(e);return this.mlContextCache.push({gpuDevice:e,mlContext:i}),i}}else if(e===void 0){let r=this.mlContextCache.findIndex(i=>i.options===void 0&&i.gpuDevice===void 0);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:i}),i}}let t=this.mlContextCache.findIndex(r=>qs(r.options,e));if(t!==-1)return this.mlContextCache[t].mlContext;{let r=await navigator.ml.createContext(e);return this.mlContextCache.push({options:e,mlContext:r}),r}}registerMLContext(e,t){this.mlContextBySessionId.set(e,t);let r=this.sessionIdsByMLContext.get(t);r||(r=new Set,this.sessionIdsByMLContext.set(t,r)),r.add(e),this.mlOpSupportLimitsBySessionId.has(e)||this.mlOpSupportLimitsBySessionId.set(e,t.opSupportLimits()),this.temporaryGraphInputs.length>0&&(this.sessionGraphInputs.set(e,this.temporaryGraphInputs),this.temporaryGraphInputs=[]),this.temporaryGraphOutputs.length>0&&(this.sessionGraphOutputs.set(e,this.temporaryGraphOutputs),this.temporaryGraphOutputs=[])}onReleaseSession(e){this.sessionGraphInputs.delete(e),this.sessionGraphOutputs.delete(e);let t=this.mlContextBySessionId.get(e);if(!t)return;this.tensorManager.releaseTensorsForSession(e),this.mlContextBySessionId.delete(e),this.mlOpSupportLimitsBySessionId.delete(e);let r=this.sessionIdsByMLContext.get(t);if(r.delete(e),r.size===0){this.sessionIdsByMLContext.delete(t);let i=this.mlContextCache.findIndex(n=>n.mlContext===t);i!==-1&&this.mlContextCache.splice(i,1)}}getMLContext(e){return this.mlContextBySessionId.get(e)}getMLOpSupportLimits(e){return this.mlOpSupportLimitsBySessionId.get(e)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(e){de("verbose",()=>`[WebNN] releaseTensorId {tensorId: ${e}}`),this.tensorManager.releaseTensorId(e)}async ensureTensor(e,t,r,i,n){let a=nr.get(r);if(!a)throw new Error(`Unsupported ONNX data type: ${r}`);return this.tensorManager.ensureTensor(e??this.currentSessionId,t,a,i,n)}async createTemporaryTensor(e,t,r){de("verbose",()=>`[WebNN] createTemporaryTensor {onnxDataType: ${t}, shape: ${r}}`);let i=nr.get(t);if(!i)throw new Error(`Unsupported ONNX data type: ${t}`);let n=this.tensorManager.reserveTensorId();await this.tensorManager.ensureTensor(e,n,i,r,!1);let a=this.temporarySessionTensorIds.get(e);return a?a.push(n):this.temporarySessionTensorIds.set(e,[n]),n}uploadTensor(e,t){if(!_e().shouldTransferToMLTensor)throw new Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");de("verbose",()=>`[WebNN] uploadTensor {tensorId: ${e}, data: ${t.byteLength}}`),this.tensorManager.upload(e,t)}async downloadTensor(e,t){return this.tensorManager.download(e,t)}createMLTensorDownloader(e,t){return async()=>{let r=await this.tensorManager.download(e);return Di(r,t)}}registerMLTensor(e,t,r,i){let n=nr.get(r);if(!n)throw new Error(`Unsupported ONNX data type: ${r}`);let a=this.tensorManager.registerTensor(e,t,n,i);return de("verbose",()=>`[WebNN] registerMLTensor {tensor: ${t}, dataType: ${n}, dimensions: ${i}} -> {tensorId: ${a}}`),a}registerMLConstant(e,t,r,i,n,a,s=!1){if(!a)throw new Error("External mounted files are not available.");let u=e;e.startsWith("./")&&(u=e.substring(2));let l=a.get(u);if(!l)throw new Error(`File with name ${u} not found in preloaded files.`);if(t+r>l.byteLength)throw new Error("Out of bounds: data offset and length exceed the external file data size.");let d=l.slice(t,t+r).buffer,c;switch(n.dataType){case"float32":c=new Float32Array(d);break;case"float16":c=typeof Float16Array<"u"?new Float16Array(d):new Uint16Array(d);break;case"int32":c=new Int32Array(d);break;case"uint32":c=new Uint32Array(d);break;case"int64":if(s){let f=Ui(new Uint8Array(d),"int64");c=new Int32Array(f.buffer),n.dataType="int32"}else c=new BigInt64Array(d);break;case"uint64":c=new BigUint64Array(d);break;case"int8":c=new Int8Array(d);break;case"int4":case"uint4":case"uint8":c=new Uint8Array(d);break;default:throw new Error(`Unsupported data type: ${n.dataType} in creating WebNN Constant from external data.`)}return de("verbose",()=>`[WebNN] registerMLConstant {dataType: ${n.dataType}, shape: ${n.shape}}} ${s?"(Note: it was int64 data type and registered to int32 as workaround)":""}`),i.constant(n,c)}registerGraphInput(e){this.temporaryGraphInputs.push(e)}registerGraphOutput(e){this.temporaryGraphOutputs.push(e)}isGraphInput(e,t){let r=this.sessionGraphInputs.get(e);return r?r.includes(t):!1}isGraphOutput(e,t){let r=this.sessionGraphOutputs.get(e);return r?r.includes(t):!1}isGraphInputOutputTypeSupported(e,t,r=!0){let i=nr.get(Et(t)),n=this.mlOpSupportLimitsBySessionId.get(e);return typeof i>"u"?!1:r?!!n?.input.dataTypes.includes(i):!!n?.output.dataTypes.includes(i)}flush(){}}}),Fi=U(()=>{}),Hi,Br,Nr,Ws,Vs,ji,Ki,Gs,Fs,M_=U(()=>{ot(),Fi(),Hi=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),Br=[],Nr=e=>Math.ceil(Number(e)/16)*16,Ws=e=>{for(let t=0;t<Br.length;t++){let r=Br[t];if(e<=r)return r}return Math.ceil(e/16)*16},Vs=1,ji=()=>Vs++,Ki=async(e,t,r,i)=>{let n=Nr(r),a=e.device.createBuffer({size:n,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let s=e.getCommandEncoder();e.endComputePass(),s.copyBufferToBuffer(t,0,a,0,n),e.flush(),await a.mapAsync(GPUMapMode.READ);let u=a.getMappedRange();if(i){let l=i();return l.set(new Uint8Array(u,0,r)),l}else return new Uint8Array(u.slice(0,r))}finally{a.destroy()}},Gs=class{constructor(e){this.backend=e,this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[t]of Hi)Br.push(t),this.freeBuffers.set(t,[]),this.freeUniformBuffers.set(t,[]);this.sessionCount=0}upload(e,t){let r=t.buffer,i=t.byteOffset,n=t.byteLength,a=Nr(n),s=this.storageCache.get(e);if(!s)throw new Error("gpu data for uploading does not exist");if(Number(s.originalSize)!==n)throw new Error(`inconsistent data size. gpu data size=${s.originalSize}, data size=${n}`);let u=this.backend.device.createBuffer({mappedAtCreation:!0,size:a,usage:GPUBufferUsage.MAP_WRITE|GPUBufferUsage.COPY_SRC}),l=u.getMappedRange();new Uint8Array(l).set(new Uint8Array(r,i,n)),u.unmap();let d=this.backend.device.createCommandEncoder();d.copyBufferToBuffer(u,0,s.gpuData.buffer,0,a),this.backend.device.queue.submit([d.finish()]),u.destroy(),de("verbose",()=>`[WebGPU] GpuDataManager.upload(id=${e})`)}memcpy(e,t){let r=this.storageCache.get(e);if(!r)throw new Error("source gpu data for memcpy does not exist");let i=this.storageCache.get(t);if(!i)throw new Error("destination gpu data for memcpy does not exist");if(r.originalSize!==i.originalSize)throw new Error("inconsistent source and destination gpu data size");let n=Nr(r.originalSize),a=this.backend.getCommandEncoder();this.backend.endComputePass(),a.copyBufferToBuffer(r.gpuData.buffer,0,i.gpuData.buffer,0,n)}registerExternalBuffer(e,t,r){let i;if(r){if(i=r[0],e===r[1])return de("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, buffer is the same, skip.`),i;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw new Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else i=ji();return this.storageCache.set(i,{gpuData:{id:i,type:0,buffer:e},originalSize:t}),de("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, registered.`),i}unregisterExternalBuffer(e){e!==void 0&&(this.storageCache.delete(e),de("verbose",()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${e}`))}create(e,t=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let r=Ws(e),i,n=(t&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,a=(t&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(n||a){let u=(n?this.freeBuffers:this.freeUniformBuffers).get(r);u?u.length>0?i=u.pop():i=this.backend.device.createBuffer({size:r,usage:t}):i=this.backend.device.createBuffer({size:r,usage:t})}else i=this.backend.device.createBuffer({size:r,usage:t});let s={id:ji(),type:0,buffer:i};return this.storageCache.set(s.id,{gpuData:s,originalSize:Number(e)}),de("verbose",()=>`[WebGPU] GpuDataManager.create(size=${e}) => id=${s.id}`),s}get(e){return this.storageCache.get(e)?.gpuData}release(e){let t=typeof e=="bigint"?Number(e):e,r=this.storageCache.get(t);if(!r){if(this.storageCache.size===0)return 0;throw new Error("releasing data does not exist")}return de("verbose",()=>`[WebGPU] GpuDataManager.release(id=${t}), gpuDataId=${r.gpuData.id}`),this.storageCache.delete(t),this.buffersPending.push(r.gpuData.buffer),r.originalSize}async download(e,t){let r=this.storageCache.get(Number(e));if(!r)throw new Error("data does not exist");await Ki(this.backend,r.gpuData.buffer,r.originalSize,t)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let e of this.buffersPending){let t=Hi.get(e.size);if((e.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let r=this.freeBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else if((e.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let r=this.freeUniformBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else e.destroy()}this.buffersPending=[]}else{let e=this.capturedPendingBuffers.get(this.backend.currentSessionId);e||(e=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,e));for(let t of this.buffersPending)e.push(t);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.freeUniformBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache.forEach(e=>{e.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(e){let t=this.capturedPendingBuffers.get(e);t&&(t.forEach(r=>{r.destroy()}),this.capturedPendingBuffers.delete(e)),this.sessionCount-=1,this.sessionCount===0&&(de("warning",()=>"[WebGPU] Clearing webgpu buffer cache"),this.storageCache.forEach(r=>{r.gpuData.buffer.destroy()}),this.storageCache=new Map)}},Fs=(...e)=>new Gs(...e)}),Hs,he,ke=U(()=>{Hs=class{constructor(e){Object.assign(this,e)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map(e=>`${this[e]}`).join(";")),this.key}},he=e=>new Hs(e)}),Ft,Mr,ze,Oe,K,xe,Zi,Ht,ht,j,ar,N,F,js,Xi,Ks,Zs,ne=U(()=>{te(),ie(),Ft=64,Mr=(e,t)=>{if(t===3)throw new Error("vec3 has same alignment as vec4, use vec4 instead");switch(Number(e)){case 10:return t>1?`vec${t}<f16>`:"f16";case 1:return t>1?`vec${t}<f32>`:"f32";case 6:return t>1?`vec${t}<i32>`:"i32";case 12:return t>1?`vec${t}<u32>`:"u32";case 7:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","i32"];case 13:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","u32"];case 9:if(t!==4)throw new Error("bool must be vec4");return["u32","vec4<bool>"];case 22:return"i32";case 21:return"u32";default:throw new Error(`Unknown data type: ${e}`)}},ze=(e,t=1)=>{let r=Mr(e,t);return typeof r=="string"?r:r[0]},Oe=(e,t=1)=>{let r=Mr(e,t);return typeof r=="string"?r:r[1]},K=(...e)=>{let t=[];return e.forEach(r=>{r.length!==0&&t.push({type:12,data:r},{type:12,data:O.computeStrides(r)})}),t},xe=e=>e%4===0?4:e%2===0?2:1,Zi=(e="f32",t,r="0")=>!t||t===1?`${e}(${r})`:`vec${t}<${e}>(${r})`,Ht=(e,t,r)=>e==="f32"?r:t===1?`f32(${r})`:`vec${t}<f32>(${r})`,ht=(e,t)=>t===4?`(${e}.x + ${e}.y + ${e}.z + ${e}.w)`:t===2?`(${e}.x + ${e}.y)`:t===3?`(${e}.x + ${e}.y + ${e}.z)`:e,j=(e,t,r,i)=>e.startsWith("uniforms.")&&r>4?typeof t=="string"?i==="f16"?`${e}[(${t}) / 8][(${t}) % 8 / 4][(${t}) % 8 % 4]`:`${e}[(${t}) / 4][(${t}) % 4]`:i==="f16"?`${e}[${Math.floor(t/8)}][${Math.floor(t%8/4)}][${t%8%4}]`:`${e}[${Math.floor(t/4)}][${t%4}]`:r>1?`${e}[${t}]`:e,ar=(e,t,r,i,n)=>{let a=typeof r=="number",s=a?r:r.length,u=[...new Array(s).keys()],l=s<2?"u32":s<=4?`vec${s}<u32>`:`array<u32, ${s}>`,d=Mr(t,n),c=typeof d=="string"?d:d[1],f=typeof d=="string"?d:d[0],g={indices:l,value:c,storage:f,tensor:t},_=P=>typeof P=="string"?P:`${P}u`,y={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},$=a?"uniforms.":"",S=`${$}${e}_shape`,x=`${$}${e}_strides`,b="";for(let P=0;P<s-1;P++)b+=`
    let dim${P} = current / ${j(x,P,s)};
    let rest${P} = current % ${j(x,P,s)};
    indices[${P}] = dim${P};
    current = rest${P};
    `;b+=`indices[${s-1}] = current;`;let z=s<2?"":`
  fn o2i_${e}(offset: u32) -> ${g.indices} {
    var indices: ${g.indices};
    var current = offset;
    ${b}
    return indices;
  }`,k=P=>(y.offsetToIndices=!0,s<2?P:`o2i_${e}(${P})`),E=[];if(s>=2)for(let P=s-1;P>=0;P--)E.push(`${j(x,P,s)} * (indices[${P}])`);let A=s<2?"":`
  fn i2o_${e}(indices: ${g.indices}) -> u32 {
    return ${E.join("+")};
  }`,C=P=>(y.indicesToOffset=!0,s<2?P:`i2o_${e}(${P})`),v=(...P)=>s===0?"0u":`${g.indices}(${P.map(_).join(",")})`,D=(P,Y)=>s<2?`${P}`:`${j(P,Y,s)}`,q=(P,Y,X)=>s<2?`${P}=${X};`:`${j(P,Y,s)}=${X};`,Q={},H=(P,Y)=>{y.broadcastedIndicesToOffset=!0;let X=`${Y.name}broadcastedIndicesTo${e}Offset`;if(X in Q)return`${X}(${P})`;let V=[];for(let Te=s-1;Te>=0;Te--){let Ce=Y.indicesGet("outputIndices",Te+Y.rank-s);V.push(`${D(x,Te)} * (${Ce} % ${D(S,Te)})`)}return Q[X]=`fn ${X}(outputIndices: ${Y.type.indices}) -> u32 {
             return ${V.length>0?V.join("+"):"0u"};
           }`,`${X}(${P})`},Z=(P,Y)=>(()=>{if(g.storage===g.value)return`${e}[${P}]=${Y};`;if(g.storage==="vec2<u32>"&&g.value==="i32")return`${e}[${P}]=vec2<u32>(u32(${Y}), select(0u, 0xFFFFFFFFu, ${Y} < 0));`;if(g.storage==="vec2<u32>"&&g.value==="u32")return`${e}[${P}]=vec2<u32>(u32(${Y}), 0u);`;if(g.storage==="u32"&&g.value==="vec4<bool>")return`${e}[${P}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${Y}));`;throw new Error(`not supported combination of storage type ${g.storage} and value type ${g.value} yet`)})(),R=P=>(()=>{if(g.storage===g.value)return`${e}[${P}]`;if(g.storage==="vec2<u32>"&&g.value==="i32")return`i32(${e}[${P}].x)`;if(g.storage==="vec2<u32>"&&g.value==="u32")return`u32(${e}[${P}].x)`;if(g.storage==="u32"&&g.value==="vec4<bool>")return`vec4<bool>(bool(${e}[${P}] & 0xFFu), bool(${e}[${P}] & 0xFF00u), bool(${e}[${P}] & 0xFF0000u), bool(${e}[${P}] & 0xFF000000u))`;throw new Error(`not supported combination of storage type ${g.storage} and value type ${g.value} yet`)})(),M=s<2?"":`
  fn get_${e}ByIndices(indices: ${g.indices}) -> ${c} {
    return ${R(`i2o_${e}(indices)`)};
  }`,G=s<2?"":(()=>{let P=u.map(X=>`d${X}: u32`).join(", "),Y=u.map(X=>`d${X}`).join(", ");return`
  fn get_${e}(${P}) -> ${c} {
    return get_${e}ByIndices(${v(Y)});
  }`})(),J=(...P)=>{if(P.length!==s)throw new Error(`indices length must be ${s}`);let Y=P.map(_).join(",");return s===0?R("0u"):s===1?R(Y[0]):(y.get=!0,y.getByIndices=!0,y.indicesToOffset=!0,`get_${e}(${Y})`)},ee=P=>s<2?R(P):(y.getByIndices=!0,y.indicesToOffset=!0,`get_${e}ByIndices(${P})`),re=s<2?"":`
  fn set_${e}ByIndices(indices: ${g.indices}, value: ${c}) {
    ${Z(`i2o_${e}(indices)`,"value")}
  }`,ae=s<2?"":(()=>{let P=u.map(X=>`d${X}: u32`).join(", "),Y=u.map(X=>`d${X}`).join(", ");return`
  fn set_${e}(${P}, value: ${c}) {
    set_${e}ByIndices(${v(Y)}, value);
  }`})();return{impl:()=>{let P=[],Y=!1;return y.offsetToIndices&&(P.push(z),Y=!0),y.indicesToOffset&&(P.push(A),Y=!0),y.broadcastedIndicesToOffset&&(Object.values(Q).forEach(X=>P.push(X)),Y=!0),y.set&&(P.push(ae),Y=!0),y.setByIndices&&(P.push(re),Y=!0),y.get&&(P.push(G),Y=!0),y.getByIndices&&(P.push(M),Y=!0),!a&&Y&&P.unshift(`const ${S} = ${g.indices}(${r.join(",")});`,`const ${x} = ${g.indices}(${O.computeStrides(r).join(",")});`),P.join(`
`)},type:g,offsetToIndices:k,indicesToOffset:C,broadcastedIndicesToOffset:H,indices:v,indicesGet:D,indicesSet:q,set:(...P)=>{if(P.length!==s+1)throw new Error(`indices length must be ${s}`);let Y=P[s];if(typeof Y!="string")throw new Error("value must be string");let X=P.slice(0,s).map(_).join(",");return s===0?Z("0u",Y):s===1?Z(X[0],Y):(y.set=!0,y.setByIndices=!0,y.indicesToOffset=!0,`set_${e}(${X}, ${Y})`)},setByOffset:Z,setByIndices:(P,Y)=>s<2?Z(P,Y):(y.setByIndices=!0,y.indicesToOffset=!0,`set_${e}ByIndices(${P}, ${Y});`),get:J,getByOffset:R,getByIndices:ee,usage:i,name:e,strides:x,shape:S,rank:s}},N=(e,t,r,i=1)=>ar(e,t,r,"input",i),F=(e,t,r,i=1)=>ar(e,t,r,"output",i),js=(e,t,r)=>ar(e,t,r,"atomicOutput",1),Xi=(e,t,r,i=1)=>ar(e,t,r,"internal",i),Ks=class{constructor(e,t){this.normalizedDispatchGroup=e,this.limits=t,this.internalVariables=[],this.variables=[],this.uniforms=[],this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(e){return`if (global_idx >= ${typeof e=="number"?`${e}u`:e}) { return; }`}mainStart(e=Ft){let t=typeof e=="number"?e:e[0],r=typeof e=="number"?1:e[1],i=typeof e=="number"?1:e[2];if(t>this.limits.maxComputeWorkgroupSizeX||r>this.limits.maxComputeWorkgroupSizeY||i>this.limits.maxComputeWorkgroupSizeZ)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(t*r*i>this.limits.maxComputeInvocationsPerWorkgroup)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let n=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1,a=n?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`,s=n?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${t*r*i}u + local_idx;`;return`@compute @workgroup_size(${t}, ${r}, ${i})
  fn main(${a}) {
    ${s}
  `}appendVariableUniforms(e){e.rank!==0&&(e.shape.startsWith("uniforms.")&&this.uniforms.push({name:e.shape.replace("uniforms.",""),type:"u32",length:e.rank}),e.strides.startsWith("uniforms.")&&this.uniforms.push({name:e.strides.replace("uniforms.",""),type:"u32",length:e.rank}))}declareVariable(e,t){if(e.usage==="internal")throw new Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");this.variables.push(e),this.appendVariableUniforms(e);let r=e.usage==="input"?"read":"read_write",i=e.usage==="atomicOutput"?"atomic<i32>":e.type.storage;return`@group(0) @binding(${t}) var<storage, ${r}> ${e.name}: array<${i}>;`}declareVariables(...e){return e.map(t=>this.declareVariable(t,this.variableIndex++)).join(`
`)}registerInternalVariable(e){if(e.usage!=="internal")throw new Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");this.internalVariables.push(e),this.appendVariableUniforms(e)}registerInternalVariables(...e){return e.forEach(t=>this.registerInternalVariable(t)),this}registerUniform(e,t,r=1){return this.uniforms.push({name:e,type:t,length:r}),this}registerUniforms(e){return this.uniforms=this.uniforms.concat(e),this}uniformDeclaration(){if(this.uniforms.length===0)return"";let e=[];for(let{name:t,type:r,length:i}of this.uniforms)if(i&&i>4)r==="f16"?e.push(`@align(16) ${t}:array<mat2x4<${r}>, ${Math.ceil(i/8)}>`):e.push(`${t}:array<vec4<${r}>, ${Math.ceil(i/4)}>`);else{let n=i==null||i===1?r:`vec${i}<${r}>`;e.push(`${t}:${n}`)}return`
      struct Uniforms { ${e.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map(e=>e.impl()).join(`
`)+this.internalVariables.map(e=>e.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let e=t=>[12,10,1,6][["u32","f16","f32","i32"].indexOf(t)];return this.uniforms.map(t=>[e(t.type),t.length??1])}},Zs=(e,t)=>new Ks(e,t)}),Xs,Qi,Qs,Ys,Js,eo,Pe,to,ro,ft=U(()=>{te(),ie(),ke(),ne(),Xs=(e,t)=>{if(!e||e.length!==1)throw new Error("Transpose requires 1 input.");if(t.length!==0&&t.length!==e[0].dims.length)throw new Error(`perm size ${t.length} does not match input rank ${e[0].dims.length}`)},Qi=(e,t)=>t.length!==0?t:[...new Array(e).keys()].reverse(),Qs=(e,t)=>O.sortBasedOnPerm(e,Qi(e.length,t)),Ys=(e,t,r,i)=>{let n=`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`;for(let a=0;a<t;++a)n+=`a[${e[a]}]=i[${a}];`;return n+="return a;}"},Js=(e,t)=>{let r=[],i=[];for(let n=0;n<e.length;++n)e[n]!==1&&r.push(e[n]),e[t[n]]!==1&&i.push(t[n]);return{newShape:r,newPerm:i}},eo=(e,t)=>{let r=0;for(let i=0;i<e.length;++i)if(t[e[i]]!==1){if(e[i]<r)return!1;r=e[i]}return!0},Pe=(e,t)=>{let r=e.dataType,i=e.dims.length,n=Qi(i,t),a=Qs(e.dims,n),s=e.dims,u=a,l=i<2||eo(n,e.dims),d;if(l)return d=y=>{let $=N("input",r,s,4),S=F("output",r,u,4);return`
  ${y.registerUniform("output_size","u32").declareVariables($,S)}
  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`},{name:"TransposeCopy",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let y=O.size(a);return{outputs:[{dims:a,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(y/64/4)},programUniforms:[{type:12,data:Math.ceil(y/4)}]}},getShaderSource:d};let{newShape:c,newPerm:f}=Js(e.dims,n),g=O.areEqual(f,[2,3,1]),_=O.areEqual(f,[3,1,2]);if(c.length===2||g||_){s=g?[c[0],c[1]*c[2]]:_?[c[0]*c[1],c[2]]:c,u=[s[1],s[0]];let y=16;return d=$=>{let S=N("a",r,s.length),x=F("output",r,u.length);return`
  ${$.registerUniform("output_size","u32").declareVariables(S,x)}
  var<workgroup> tile : array<array<${x.type.value}, ${y+1}>, ${y}>;
  ${$.mainStart([y,y,1])}
    let stride = (uniforms.output_shape[1] - 1) / ${y} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${y}u + local_id.x;
    let input_row = workgroup_id_x * ${y}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${S.getByIndices(`${S.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${y}u + local_id.x;
    let output_row = workgroup_id_y * ${y}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${x.setByIndices(`${x.type.indices}(output_row, output_col)`,"tile[local_id.x][local_id.y]")}
    }
  }`},{name:"TransposeShared",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let $=O.size(a);return{outputs:[{dims:a,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(u[1]/y),y:Math.ceil(u[0]/y)},programUniforms:[{type:12,data:$},...K(s,u)]}},getShaderSource:d}}return d=y=>{let $=N("a",r,s.length),S=F("output",r,u.length);return`
  ${y.registerUniform("output_size","u32").declareVariables($,S)}

  ${Ys(n,i,$,S)}

  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${S.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${S.setByOffset("global_idx",$.getByIndices("aIndices"))}
  }`},{name:"Transpose",shaderCache:{hint:`${t}`,inputDependencies:["rank"]},getRunData:()=>{let y=O.size(a);return{outputs:[{dims:a,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(y/64)},programUniforms:[{type:12,data:y},...K(s,u)]}},getShaderSource:d}},to=(e,t)=>{Xs(e.inputs,t.perm),e.compute(Pe(e.inputs[0],t.perm))},ro=e=>he({perm:e.perm})}),io,no,ao,so,oo,uo,lo,po,co,ho,He,fo,mo,go,_o,yo,bo,wo,$o,vo,xo,D_=U(()=>{te(),ie(),ne(),Ji(),ft(),io={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate * candidate",logSumExp:"bestValue + exp(candidate)",l1:"bestValue + abs(candidate)",l2:"bestValue + candidate * candidate",logSum:"bestValue + candidate"},no={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate",logSumExp:"bestValue + candidate",l1:"bestValue + candidate",l2:"bestValue + candidate",logSum:"bestValue + candidate"},ao={max:"_A[offset]",min:"_A[offset]",mean:"0",sum:"0",prod:"1",sumSquare:"0",logSumExp:"0",l1:"0",l2:"0",logSum:"0"},so={max:"bestValue",min:"bestValue",sum:"bestValue",prod:"bestValue",sumSquare:"bestValue",logSumExp:"log(bestValue)",l1:"bestValue",l2:"sqrt(bestValue)",logSum:"log(bestValue)"},oo=(e,t)=>{let r=[];for(let i=t-e;i<t;++i)r.push(i);return r},uo=(e,t)=>{let r=[],i=e.length;for(let a=0;a<i;a++)t.indexOf(a)===-1&&r.push(e[a]);let n=t.map(a=>e[a]);return[r,n]},lo=(e,t)=>{let r=e.length+t.length,i=[],n=0;for(let a=0;a<r;a++)t.indexOf(a)===-1?i.push(e[n++]):i.push(1);return i},po=(e,t)=>{for(let r=0;r<e.length;++r)if(e[e.length-r-1]!==t-1-r)return!1;return!0},co=(e,t)=>{let r=[];if(!po(e,t)){for(let i=0;i<t;++i)e.indexOf(i)===-1&&r.push(i);e.forEach(i=>r.push(i))}return r},ho=(e,t,r,i,n,a,s)=>{let u=r[0].dims,l=O.size(a),d=O.size(s),c=N("_A",r[0].dataType,u),f=F("output",n,a),g=64;l===1&&(g=256);let _=`
          var<workgroup> aBestValues : array<f32, ${g}>;
       `,y=$=>`
        ${$.registerUniform("reduceSize","u32").declareVariables(c,f)}
        ${_}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${$.mainStart(g)}

          let outputIndex = global_idx / ${g};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${ao[i]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${g}) {
           let candidate = f32(${c.getByOffset("offset + k")});
           bestValue = ${io[i]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${g}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${no[i]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${f.setByOffset("outputIndex",`${i==="mean"?`${f.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${f.type.storage}(${so[i]})`}`)};
         }
        }`;return{name:e,shaderCache:{hint:`${t};${g}`,inputDependencies:["type"]},getShaderSource:y,getRunData:()=>({outputs:[{dims:a,dataType:n}],dispatchGroup:{x:l},programUniforms:[{type:12,data:d}]})}},He=(e,t,r,i)=>{let n=e.inputs.length===1?r:Yi(e.inputs,r),a=n.axes;a.length===0&&!n.noopWithEmptyAxes&&(a=e.inputs[0].dims.map((_,y)=>y));let s=O.normalizeAxes(a,e.inputs[0].dims.length),u=s,l=e.inputs[0],d=co(u,e.inputs[0].dims.length);d.length>0&&(l=e.compute(Pe(e.inputs[0],d),{inputs:[0],outputs:[-1]})[0],u=oo(u.length,l.dims.length));let[c,f]=uo(l.dims,u),g=c;n.keepDims&&(g=lo(c,s)),e.compute(ho(t,n.cacheKey,[l],i,e.inputs[0].dataType,g,f),{inputs:[l]})},fo=(e,t)=>{He(e,"ReduceMeanShared",t,"mean")},mo=(e,t)=>{He(e,"ReduceL1Shared",t,"l1")},go=(e,t)=>{He(e,"ReduceL2Shared",t,"l2")},_o=(e,t)=>{He(e,"ReduceLogSumExpShared",t,"logSumExp")},yo=(e,t)=>{He(e,"ReduceMaxShared",t,"max")},bo=(e,t)=>{He(e,"ReduceMinShared",t,"min")},wo=(e,t)=>{He(e,"ReduceProdShared",t,"prod")},$o=(e,t)=>{He(e,"ReduceSumShared",t,"sum")},vo=(e,t)=>{He(e,"ReduceSumSquareShared",t,"sumSquare")},xo=(e,t)=>{He(e,"ReduceLogSumShared",t,"logSum")}}),je,ko,Dr,Yi,Ke,So,To,zo,Eo,Io,Co,Ao,Oo,Ro,Bo,Ze,No,Mo,Do,Po,Uo,qo,Lo,Wo,Vo,Go,Ji=U(()=>{te(),ie(),ke(),ne(),D_(),je=e=>{if(!e||e.length===0||e.length>2)throw new Error("Reduce op requires 1 or 2 inputs.");if(e.length===2&&e[1].dims.length!==1)throw new Error("Invalid axes input dims.")},ko=e=>["","",`var value = ${e.getByIndices("input_indices")};`,""],Dr=(e,t,r,i,n,a,s=!1,u=!1)=>{let l=[],d=r[0].dims,c=d.length,f=O.normalizeAxes(n,c),g=!u&&f.length===0;d.forEach(($,S)=>{g||f.indexOf(S)>=0?s&&l.push(1):l.push($)});let _=l.length,y=O.size(l);return{name:e,shaderCache:t,getShaderSource:$=>{let S=[],x=N("_A",r[0].dataType,c),b=F("output",a,_),z=i(x,b,f),k=z[2];for(let E=0,A=0;E<c;E++)g||f.indexOf(E)>=0?(s&&A++,k=`for(var j${E}: u32 = 0; j${E} < ${d[E]}; j${E}++) {
                  ${z[2].includes("last_index")?`let last_index = j${E};`:""}
                  ${x.indicesSet("input_indices",E,`j${E}`)}
                  ${k}
                }`):(S.push(`${x.indicesSet("input_indices",E,b.indicesGet("output_indices",A))};`),A++);return`

        ${$.registerUniform("output_size","u32").declareVariables(x,b)}

        ${$.mainStart()}
          ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${x.type.indices};
          let output_indices = ${b.offsetToIndices("global_idx")};

          ${S.join(`
`)}
          ${z[0]}       // init ops for reduce max/min
          ${z[1]}
          ${k}
          ${z[3]}
          ${z.length===4?b.setByOffset("global_idx","value"):z.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:l,dataType:a}],dispatchGroup:{x:Math.ceil(y/64)},programUniforms:[{type:12,data:y},...K(d,l)]})}},Yi=(e,t)=>{let r=[];return e[1].dims[0]>0&&e[1].getBigInt64Array().forEach(i=>r.push(Number(i))),he({axes:r,keepDims:t.keepDims,noopWithEmptyAxes:t.noopWithEmptyAxes})},Ke=(e,t,r,i)=>{let n=e.inputs,a=n.length===1?r:Yi(n,r);e.compute(Dr(t,{hint:a.cacheKey,inputDependencies:["rank"]},[n[0]],a.noopWithEmptyAxes&&a.axes.length===0?ko:i,a.axes,n[0].dataType,a.keepDims,a.noopWithEmptyAxes),{inputs:[0]})},So=(e,t)=>{je(e.inputs),Ke(e,"ReduceLogSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,"value = log(value);"])},To=(e,t)=>{je(e.inputs),Ke(e,"ReduceL1",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += abs(${r.getByIndices("input_indices")});`,""])},zo=(e,t)=>{je(e.inputs),Ke(e,"ReduceL2",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += (t * t);`,"value = sqrt(value);"])},Eo=(e,t)=>{je(e.inputs),Ke(e,"ReduceLogSumExp",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += exp(${r.getByIndices("input_indices")});`,"value = log(value);"])},Io=(e,t)=>{je(e.inputs),Ke(e,"ReduceMax",t,(r,i,n)=>{let a=[];for(let s=0;s<r.rank;s++)(n.indexOf(s)>=0||n.length===0)&&a.push(r.indicesSet("input_indices",s,0));return[`${a.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = max(value, ${r.getByIndices("input_indices")});`,""]})},Co=(e,t)=>{je(e.inputs),Ke(e,"ReduceMean",t,(r,i,n)=>{let a=1;for(let s=0;s<r.rank;s++)(n.indexOf(s)>=0||n.length===0)&&(a*=e.inputs[0].dims[s]);return["var sum = f32(0);","",`sum += f32(${r.getByIndices("input_indices")});`,`let value = ${i.type.value}(sum / ${a});`]})},Ao=(e,t)=>{je(e.inputs),Ke(e,"ReduceMin",t,(r,i,n)=>{let a=[];for(let s=0;s<r.rank;s++)(n.indexOf(s)>=0||n.length===0)&&a.push(`input_indices[${s}] = 0;`);return[`${a.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = min(value, ${r.getByIndices("input_indices")});`,""]})},Oo=(e,t)=>{je(e.inputs),Ke(e,"ReduceProd",t,(r,i)=>[`var value = ${i.type.storage}(1);`,"",`value *= ${r.getByIndices("input_indices")};`,""])},Ro=(e,t)=>{je(e.inputs),Ke(e,"ReduceSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,""])},Bo=(e,t)=>{je(e.inputs),Ke(e,"ReduceSumSquare",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += t * t;`,""])},Ze=(e,t,r)=>{if(t.length===0)return r;let i=1,n=1;for(let a=0;a<t.length;a++)t.indexOf(a)===-1?i*=e[a]:n*=e[a];return n<32&&i>1024},No=(e,t)=>{Ze(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Co(e,t):fo(e,t)},Mo=(e,t)=>{Ze(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?To(e,t):mo(e,t)},Do=(e,t)=>{Ze(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?zo(e,t):go(e,t)},Po=(e,t)=>{Ze(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Eo(e,t):_o(e,t)},Uo=(e,t)=>{Ze(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Io(e,t):yo(e,t)},qo=(e,t)=>{Ze(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Ao(e,t):bo(e,t)},Lo=(e,t)=>{Ze(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Oo(e,t):wo(e,t)},Wo=(e,t)=>{Ze(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Ro(e,t):$o(e,t)},Vo=(e,t)=>{Ze(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Bo(e,t):vo(e,t)},Go=(e,t)=>{Ze(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?So(e,t):xo(e,t)}}),en,Fo,Ho,tn,P_=U(()=>{te(),ke(),Ji(),en=e=>{if(!e||e.length===0||e.length>2)throw new Error("ArgMinMaxOp op requires 1 or 2 inputs.");if(e[0].dataType!==1)throw new Error("Invalid input type.")},Fo=(e,t)=>{en(e.inputs);let r=(i,n,a)=>{let s=[];for(let u=0;u<i.rank;u++)(a.indexOf(u)>=0||a.length===0)&&s.push(`input_indices[${u}] = 0;`);return[`${s.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?"<=":"<"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",n.setByOffset("global_idx","best_index")]};e.compute(Dr("ArgMin",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},Ho=(e,t)=>{en(e.inputs);let r=(i,n,a)=>{let s=[];for(let u=0;u<i.rank;u++)(a.indexOf(u)>=0||a.length===0)&&s.push(`input_indices[${u}] = 0;`);return[`${s.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?">=":">"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",n.setByOffset("global_idx","best_index")]};e.compute(Dr("argMax",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},tn=e=>he(e)}),jo,Pr,Ko,Zo,Xo,sr,Qo,Yo,rn=U(()=>{te(),ie(),Fi(),ne(),jo=(e,t)=>{let r=e[0],i=e[1],n=e[2],a=e[3],s=e[4],u=e[5];if(s&&u)throw new Error("Attention cannot have both past and attention_bias");if(r.dims.length!==3)throw new Error('Input "input" must have 3 dimensions');let l=r.dims[0],d=r.dims[1],c=r.dims[2];if(n.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimensions');if(i.dims.length!==2)throw new Error('Input "weights" is expected to have 2 dimensions');if(i.dims[0]!==c)throw new Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");if(n.dims[0]!==i.dims[1])throw new Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');let f=n.dims[0]/3,g=f,_=g;if(t.qkvHiddenSizes.length>0){if(t.qkvHiddenSizes.length!==3)throw new Error("qkv_hidden_sizes attribute should have 3 elements");for(let z of t.qkvHiddenSizes)if(z%t.numHeads!==0)throw new Error("qkv_hidden_sizes should be divisible by num_heads");f=t.qkvHiddenSizes[0],g=t.qkvHiddenSizes[1],_=t.qkvHiddenSizes[2]}let y=d;if(f!==g)throw new Error("qkv_hidden_sizes first element should be same as the second");if(n.dims[0]!==f+g+_)throw new Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');let $=0;if(s){if(g!==_)throw new Error('Input "past" expect k_hidden_size == v_hidden_size');if(s.dims.length!==5)throw new Error('Input "past" must have 5 dimensions');if(s.dims[0]!==2)throw new Error('Input "past" first dimension must be 2');if(s.dims[1]!==l)throw new Error('Input "past" second dimension must be batch_size');if(s.dims[2]!==t.numHeads)throw new Error('Input "past" third dimension must be num_heads');if(s.dims[4]!==g/t.numHeads)throw new Error('Input "past" fifth dimension must be k_hidden_size / num_heads');t.pastPresentShareBuffer||($=s.dims[3])}let S=y+$,x=-1,b=0;if(a)throw new Error("Mask not supported");if(s)throw new Error("past is not supported");if(u){if(u.dims.length!==4)throw new Error('Input "attention_bias" must have 4 dimensions');if(u.dims[0]!==l||u.dims[1]!==t.numHeads||u.dims[2]!==d||u.dims[3]!==S)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:l,sequenceLength:d,pastSequenceLength:$,kvSequenceLength:y,totalSequenceLength:S,maxSequenceLength:x,inputHiddenSize:c,hiddenSize:f,vHiddenSize:_,headSize:Math.floor(f/t.numHeads),vHeadSize:Math.floor(_/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:b,scale:t.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},Pr=(e,t,r)=>t&&e?`
      let total_sequence_length_input = u32(${t.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${e?.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${r?"let past_sequence_length = uniforms.past_sequence_length":""};
    let present_sequence_length = total_sequence_length;
    `,Ko=(e,t,r,i,n,a,s,u)=>{let l=xe(s?1:a),d=64,c=a/l;c<d&&(d=32);let f=Math.ceil(a/l/d),g=[{type:12,data:t},{type:12,data:r},{type:12,data:i},{type:12,data:n},{type:12,data:c},{type:12,data:f}],_=ze(e.dataType,l),y=Oe(1,l),$=["type"];s&&$.push("type"),u&&$.push("type");let S=x=>{let b=F("x",e.dataType,e.dims,l),z=[b],k=s?N("seq_lens",s.dataType,s.dims):void 0;k&&z.push(k);let E=u?N("total_sequence_length_input",u.dataType,u.dims):void 0;E&&z.push(E);let A=Oe(e.dataType),C=[{name:"batch_size",type:"u32"},{name:"num_heads",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"sequence_length",type:"u32"},{name:"total_sequence_length",type:"u32"},{name:"elements_per_thread",type:"u32"}];return`
  var<workgroup> thread_max: array<f32, ${d}>;
  var<workgroup> thread_sum: array<f32, ${d}>;
  ${x.registerUniforms(C).declareVariables(...z)}
  ${x.mainStart([d,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${Pr(k,E,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${d}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${s?"u32(past_sequence_length + workgroup_id.y + 1)":"total_sequence_length"};
    var thread_max_vector = ${y}(-3.4028234663852886e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${y}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(l){case 1:return"thread_max_vector";case 2:return"max(thread_max_vector.x, thread_max_vector.y)";case 4:return"max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";default:throw new Error(`Unsupported components: ${l}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.4028234663852886e+38f);
    for (var i = 0u; i < ${d}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${y}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${y}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(l){case 1:return"sum_vector";case 2:return"sum_vector.x + sum_vector.y";case 4:return"sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";default:throw new Error(`Unsupported components: ${l}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${d}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${b.type.value}(${A}(1.0) / ${A}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${y}(x[offset + i]);
        x[offset + i] = ${b.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${s?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${b.type.value}(${A}(0));
        }`:""};
  }`};return{name:"AttentionProbsSoftmax",shaderCache:{hint:`${d};${_};${l}`,inputDependencies:$},getShaderSource:S,getRunData:()=>({outputs:[],dispatchGroup:{x:1,y:n,z:t*r},programUniforms:g})}},Zo=(e,t,r,i,n,a,s,u,l)=>{let d=s+a.kvSequenceLength,c=[a.batchSize,a.numHeads,a.sequenceLength,d],f=e>1&&i,g=a.kvNumHeads?a.kvNumHeads:a.numHeads,_=f?[a.batchSize,g,d,a.headSize]:void 0,y=a.nReps?a.nReps:1,$=a.scale===0?1/Math.sqrt(a.headSize):a.scale,S=xe(a.headSize),x=a.headSize/S,b=12,z={x:Math.ceil(d/b),y:Math.ceil(a.sequenceLength/b),z:a.batchSize*a.numHeads},k=[{type:12,data:a.sequenceLength},{type:12,data:x},{type:12,data:d},{type:12,data:a.numHeads},{type:12,data:a.headSize},{type:1,data:$},{type:12,data:s},{type:12,data:a.kvSequenceLength},{type:12,data:y}],E=f&&i&&O.size(i.dims)>0,A=["type","type"];E&&A.push("type"),n&&A.push("type"),u&&A.push("type"),l&&A.push("type");let C=[{dims:c,dataType:t.dataType,gpuDataType:0}];f&&C.push({dims:_,dataType:t.dataType,gpuDataType:0});let v=D=>{let q=N("q",t.dataType,t.dims,S),Q=N("key",r.dataType,r.dims,S),H=[q,Q];if(E){let re=N("past_key",i.dataType,i.dims,S);H.push(re)}n&&H.push(N("attention_bias",n.dataType,n.dims));let Z=u?N("seq_lens",u.dataType,u.dims):void 0;Z&&H.push(Z);let R=l?N("total_sequence_length_input",l.dataType,l.dims):void 0;R&&H.push(R);let M=F("output",t.dataType,c),G=[M];f&&G.push(F("present_key",t.dataType,_,S));let J=Oe(1,S),ee=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"alpha",type:"f32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${b}u;

  var<workgroup> tileQ: array<${q.type.storage}, ${b*b}>;
  var<workgroup> tileK: array<${q.type.storage}, ${b*b}>;
  ${D.registerUniforms(ee).declareVariables(...H,...G)}
  ${D.mainStart([b,b,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${y===1?"headIdx":"headIdx / uniforms.n_reps"};
    let kv_num_heads = ${y===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${Pr(Z,R,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${E&&f?"let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;":""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${f?"let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;":""}
    var value = ${J}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${E&&f?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${f?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${J}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch(S){case 1:return"value";case 2:return"value.x + value.y";case 4:return"value.x + value.y + value.z + value.w";default:throw new Error(`Unsupported components: ${S}`)}})()};
        output[outputIdx] = ${M.type.value} (sum * uniforms.alpha) + ${n?"attention_bias[outputIdx]":"0.0"};
    }
  }`};return{name:"AttentionProbs",shaderCache:{hint:`${S};${n!==void 0};${i!==void 0};${e}`,inputDependencies:A},getRunData:()=>({outputs:C,dispatchGroup:z,programUniforms:k}),getShaderSource:v}},Xo=(e,t,r,i,n,a,s=void 0,u=void 0)=>{let l=a+n.kvSequenceLength,d=n.nReps?n.nReps:1,c=n.vHiddenSize*d,f=e>1&&i,g=n.kvNumHeads?n.kvNumHeads:n.numHeads,_=f?[n.batchSize,g,l,n.headSize]:void 0,y=[n.batchSize,n.sequenceLength,c],$=12,S={x:Math.ceil(n.vHeadSize/$),y:Math.ceil(n.sequenceLength/$),z:n.batchSize*n.numHeads},x=[{type:12,data:n.sequenceLength},{type:12,data:l},{type:12,data:n.vHeadSize},{type:12,data:n.numHeads},{type:12,data:n.headSize},{type:12,data:c},{type:12,data:a},{type:12,data:n.kvSequenceLength},{type:12,data:d}],b=f&&i&&O.size(i.dims)>0,z=["type","type"];b&&z.push("type"),s&&z.push("type"),u&&z.push("type");let k=[{dims:y,dataType:t.dataType,gpuDataType:0}];f&&k.push({dims:_,dataType:t.dataType,gpuDataType:0});let E=A=>{let C=N("probs",t.dataType,t.dims),v=N("v",r.dataType,r.dims),D=[C,v];b&&D.push(N("past_value",i.dataType,i.dims));let q=s?N("seq_lens",s.dataType,s.dims):void 0;s&&D.push(q);let Q=u?N("total_sequence_length_input",u.dataType,u.dims):void 0;u&&D.push(Q);let H=[F("output",t.dataType,y)];f&&H.push(F("present_value",t.dataType,_));let Z=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"v_hidden_size",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${$}u;
  var<workgroup> tileQ: array<${C.type.value}, ${$*$}>;
  var<workgroup> tileV: array<${C.type.value}, ${$*$}>;
  ${A.registerUniforms(Z).declareVariables(...D,...H)}
  ${A.mainStart([$,$,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${d===1?"headIdx":"headIdx / uniforms.n_reps"};
   let kv_num_heads = ${d===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${Pr(q,Q,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${b&&f?"let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;":""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${f?"let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;":""}
   var value = ${C.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${b&&f?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${f?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`};return{name:"AttentionScore",shaderCache:{hint:`${i!==void 0};${e}`,inputDependencies:z},getRunData:()=>({outputs:k,dispatchGroup:S,programUniforms:x}),getShaderSource:E}},sr=(e,t,r,i,n,a,s,u,l,d,c=void 0,f=void 0)=>{let g=Math.min(e.outputCount,1+(s?1:0)+(u?1:0)),_=g>1?s:void 0,y=g>1?u:void 0,$=g>1?d.pastSequenceLength:0,S=$+d.kvSequenceLength,x=l&&O.size(l.dims)>0?l:void 0,b=[t,r];_&&O.size(_.dims)>0&&b.push(_),x&&b.push(x),c&&b.push(c),f&&b.push(f);let z=e.compute(Zo(g,t,r,_,x,d,$,c,f),{inputs:b,outputs:g>1?[-1,1]:[-1]})[0];e.compute(Ko(z,d.batchSize,d.numHeads,$,d.sequenceLength,S,c,f),{inputs:c&&f?[z,c,f]:[z],outputs:[]});let k=[z,i];y&&O.size(y.dims)>0&&k.push(y),c&&k.push(c),f&&k.push(f),e.compute(Xo(g,z,i,y,d,$,c,f),{inputs:k,outputs:g>1?[0,2]:[0]})},Qo=(e,t)=>{let r=[t.batchSize,t.numHeads,t.sequenceLength,t.headSize],i=t.sequenceLength,n=t.inputHiddenSize,a=t.headSize,s=12,u={x:Math.ceil(t.headSize/s),y:Math.ceil(t.sequenceLength/s),z:t.batchSize*t.numHeads},l=[e.inputs[0],e.inputs[1],e.inputs[2]],d=[{type:12,data:i},{type:12,data:n},{type:12,data:a},{type:12,data:t.numHeads},{type:12,data:t.headSize},{type:12,data:t.hiddenSize},{type:12,data:t.hiddenSize+t.hiddenSize+t.vHiddenSize}],c=f=>{let g=F("output_q",l[0].dataType,r),_=F("output_k",l[0].dataType,r),y=F("output_v",l[0].dataType,r),$=N("input",l[0].dataType,l[0].dims),S=N("weight",l[1].dataType,l[1].dims),x=N("bias",l[2].dataType,l[2].dims),b=$.type.storage,z=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"hidden_size",type:"u32"},{name:"ldb",type:"u32"}];return`
  const TILE_SIZE = ${s}u;
  var<workgroup> tileInput: array<${b}, ${s*s}>;
  var<workgroup> tileWeightQ: array<${b}, ${s*s}>;
  var<workgroup> tileWeightK: array<${b}, ${s*s}>;
  var<workgroup> tileWeightV: array<${b}, ${s*s}>;
  ${f.registerUniforms(z).declareVariables($,S,x,g,_,y)}
  ${f.mainStart([s,s,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${b}(0);
    var valueK = ${b}(0);
    var valueV = ${b}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`};return e.compute({name:"AttentionPrepare",shaderCache:{inputDependencies:["type","type","type"]},getRunData:()=>({outputs:[{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0}],dispatchGroup:u,programUniforms:d}),getShaderSource:c},{inputs:l,outputs:[-1,-1,-1]})},Yo=(e,t)=>{let r=jo(e.inputs,t),[i,n,a]=Qo(e,r);return sr(e,i,n,a,e.inputs[4],void 0,void 0,void 0,e.inputs[5],r)}}),Jo,eu,tu,ru,U_=U(()=>{Ue(),te(),ie(),ke(),ne(),Jo=(e,t)=>{if(!e||e.length!==5)throw new Error("BatchNormalization requires 5 inputs");let r=(i,n,a)=>{let s=n.length;if(s!==i.length)throw new Error(`${a}: num dimensions != ${s}`);n.forEach((u,l)=>{if(u!==i[l])throw new Error(`${a}: dim[${l}] do not match`)})};if(e[0].dims.length>1){let i=t.format==="NHWC"?t.spatial?e[0].dims.slice(-1):e[0].dims.slice(-1).concat(e[0].dims.slice(1,e[0].dims.length-1)):e[0].dims.slice(1,t.spatial?2:void 0);r(e[1].dims,i,"Invalid input scale"),r(e[2].dims,i,"Invalid input B"),r(e[3].dims,i,"Invalid input mean"),r(e[4].dims,i,"Invalid input var")}else r(e[1].dims,[1],"Invalid input scale"),r(e[2].dims,[1],"Invalid input B"),r(e[3].dims,[1],"Invalid input mean"),r(e[4].dims,[1],"Invalid input var")},eu=(e,t)=>{let{epsilon:r,spatial:i,format:n}=t,a=e[0].dims,s=i?xe(a[a.length-1]):1,u=n==="NHWC"&&a.length>1?s:1,l=O.size(a)/s,d=i,c=d?a.length:a,f=N("x",e[0].dataType,e[0].dims,s),g=N("scale",e[1].dataType,e[1].dims,u),_=N("bias",e[2].dataType,e[2].dims,u),y=N("inputMean",e[3].dataType,e[3].dims,u),$=N("inputVar",e[4].dataType,e[4].dims,u),S=F("y",e[0].dataType,c,s),x=()=>{let z="";if(i)z=`let cOffset = ${a.length===1?"0u":n==="NHWC"?`outputIndices[${a.length-1}] / ${s}`:"outputIndices[1]"};`;else if(n==="NCHW")z=`
            ${S.indicesSet("outputIndices","0","0")}
            let cOffset = ${S.indicesToOffset("outputIndices")};`;else{z=`var cIndices = ${g.type.indices}(0);
                       cIndices[0] = outputIndices[${a.length-1}];`;for(let k=1;k<g.rank;k++)z+=`cIndices[${k}] = outputIndices[${k}];`;z+=`let cOffset = ${g.indicesToOffset("cIndices")};`}return z},b=z=>`
  const epsilon = ${r};
  ${z.registerUniform("outputSize","u32").declareVariables(f,g,_,y,$,S)}
  ${z.mainStart()}
  ${z.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${S.offsetToIndices(`global_idx * ${s}`)};
    ${x()}
    let scale = ${g.getByOffset("cOffset")};
    let bias = ${_.getByOffset("cOffset")};
    let inputMean = ${y.getByOffset("cOffset")};
    let inputVar = ${$.getByOffset("cOffset")};
    let x = ${f.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${S.setByOffset("global_idx","value")}
  }`;return{name:"BatchNormalization",shaderCache:{hint:`${t.epsilon}_${t.format}_${i}_${s}`,inputDependencies:d?["rank","type","type","type","type"]:void 0},getShaderSource:b,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:d?[{type:12,data:l},...K(a)]:[{type:12,data:l}]})}},tu=e=>he(e),ru=(e,t)=>{let{inputs:r,outputCount:i}=e,n=tu({...t,outputCount:i});if(be.webgpu.validateInputContent&&Jo(r,n),t.trainingMode)throw new Error("BatchNormalization trainingMode is not supported yet.");e.compute(eu(r,n))}}),iu,nu,au,q_=U(()=>{ie(),ne(),iu=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![320,640,1280].includes(e[0].dims[2]))throw new Error("number of channels should be 320, 640 or 1280");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},nu=e=>{let t=e[0].dims,r=e[0].dims[2],i=O.size(t)/4,n=e[0].dataType,a=N("input",n,t,4),s=N("bias",n,[r],4),u=N("residual",n,t,4),l=F("output",n,t,4);return{name:"BiasAdd",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(i/64)}}),getShaderSource:d=>`
  const channels = ${r}u / 4;
  ${d.declareVariables(a,s,u,l)}

  ${d.mainStart()}
    ${d.guardAgainstOutOfBoundsWorkgroupSizes(i)}
    let value = ${a.getByOffset("global_idx")}
      + ${s.getByOffset("global_idx % channels")} + ${u.getByOffset("global_idx")};
    ${l.setByOffset("global_idx","value")}
  }`}},au=e=>{iu(e.inputs),e.compute(nu(e.inputs))}}),su,ce,ou,uu,lu,du,pu,cu,hu,fu,mu,gu,_u,yu,bu,wu,or,$u,Ur,vu,xu,ku,Su,Tu,zu,Eu,Iu,Cu,Au,Ou,Ru,Bu,Nu,Mu,Du,nn,Pu,an,sn,Uu,qu,Lu,Wu,Vu,Gu,on=U(()=>{te(),ie(),ke(),ne(),su=(e,t,r,i,n,a,s)=>{let u=Math.ceil(t/4),l="";typeof n=="string"?l=`${n}(a)`:l=n("a");let d=N("inputData",r,[u],4),c=F("outputData",i,[u],4),f=[{name:"vec_size",type:"u32"}];return s&&f.push(...s),`
      ${e.registerUniforms(f).declareVariables(d,c)}

  ${a??""}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${d.getByOffset("global_idx")};
    ${c.setByOffset("global_idx",l)}
  }`},ce=(e,t,r,i,n,a=e.dataType,s,u)=>{let l=[{type:12,data:Math.ceil(O.size(e.dims)/4)}];return s&&l.push(...s),{name:t,shaderCache:{hint:n,inputDependencies:["type"]},getShaderSource:d=>su(d,O.size(e.dims),e.dataType,a,r,i,u),getRunData:d=>({outputs:[{dims:e.dims,dataType:a}],dispatchGroup:{x:Math.ceil(O.size(d[0].dims)/64/4)},programUniforms:l})}},ou=e=>{e.compute(ce(e.inputs[0],"Abs","abs"))},uu=e=>{e.compute(ce(e.inputs[0],"Acos","acos"))},lu=e=>{e.compute(ce(e.inputs[0],"Acosh","acosh"))},du=e=>{e.compute(ce(e.inputs[0],"Asin","asin"))},pu=e=>{e.compute(ce(e.inputs[0],"Asinh","asinh"))},cu=e=>{e.compute(ce(e.inputs[0],"Atan","atan"))},hu=e=>{e.compute(ce(e.inputs[0],"Atanh","atanh"))},fu=e=>he(e),mu=(e,t)=>{let r;switch(t.to){case 10:r="vec4<f16>";break;case 1:r="vec4<f32>";break;case 12:r="vec4<u32>";break;case 6:r="vec4<i32>";break;case 9:r="vec4<bool>";break;default:throw new RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${t.to}`)}e.compute(ce(e.inputs[0],"Cast",r,void 0,t.cacheKey,t.to))},gu=e=>{let t,r,i=e.length>=2&&e[1].data!==0,n=e.length>=3&&e[2].data!==0;switch(e[0].dataType){case 1:t=i?e[1].getFloat32Array()[0]:-34028234663852886e22,r=n?e[2].getFloat32Array()[0]:34028234663852886e22;break;case 10:t=i?e[1].getUint16Array()[0]:64511,r=n?e[2].getUint16Array()[0]:31743;break;default:throw new Error("Unsupport data type")}return he({min:t,max:r})},_u=(e,t)=>{let r=t||gu(e.inputs),i=Oe(e.inputs[0].dataType);e.compute(ce(e.inputs[0],"Clip",n=>`clamp(${n}, vec4<${i}>(uniforms.min), vec4<${i}>(uniforms.max))`,void 0,r.cacheKey,void 0,[{type:e.inputs[0].dataType,data:r.min},{type:e.inputs[0].dataType,data:r.max}],[{name:"min",type:i},{name:"max",type:i}]),{inputs:[0]})},yu=e=>{e.compute(ce(e.inputs[0],"Ceil","ceil"))},bu=e=>{e.compute(ce(e.inputs[0],"Cos","cos"))},wu=e=>{e.compute(ce(e.inputs[0],"Cosh","cosh"))},or=e=>he(e),$u=(e,t)=>{let r=Oe(e.inputs[0].dataType);e.compute(ce(e.inputs[0],"Elu",i=>`elu_vf32(${i})`,`
  const elu_alpha_ = ${r}(${t.alpha});

  fn elu_f32(a: ${r}) -> ${r} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${r}>) -> vec4<${r}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,t.cacheKey))},Ur=(e="f32")=>`
const r0: ${e} = 0.3275911;
const r1: ${e} = 0.254829592;
const r2: ${e} = -0.284496736;
const r3: ${e} = 1.421413741;
const r4: ${e} = -1.453152027;
const r5: ${e} = 1.061405429;

fn erf_vf32(v: vec4<${e}>) -> vec4<${e}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,vu=e=>{let t=Oe(e.inputs[0].dataType);e.compute(ce(e.inputs[0],"Erf",r=>`erf_vf32(${r})`,Ur(t)))},xu=e=>{e.compute(ce(e.inputs[0],"Exp","exp"))},ku=e=>{e.compute(ce(e.inputs[0],"Floor","floor"))},Su=e=>{let t=Oe(e.inputs[0].dataType);e.compute(ce(e.inputs[0],"Gelu",r=>`0.5 * ${r} * (1.0 + erf_vf32(${r} * 0.7071067811865475))`,Ur(t)))},Tu=(e,t)=>{let r=Oe(e.inputs[0].dataType);e.compute(ce(e.inputs[0],"LeakyRelu",i=>`select(leaky_relu_alpha_ * ${i}, ${i}, ${i} >= vec4<${r}>(0.0))`,`const leaky_relu_alpha_ = ${r}(${t.alpha});`,t.cacheKey))},zu=e=>{e.compute(ce(e.inputs[0],"Not",t=>`!${t}`))},Eu=e=>{e.compute(ce(e.inputs[0],"Neg",t=>`-${t}`))},Iu=e=>{e.compute(ce(e.inputs[0],"Reciprocal",t=>`1.0/${t}`))},Cu=e=>{let t=Oe(e.inputs[0].dataType);e.compute(ce(e.inputs[0],"Relu",r=>`select(vec4<${t}>(0.0), ${r}, ${r} > vec4<${t}>(0.0))`))},Au=e=>{e.compute(ce(e.inputs[0],"Sigmoid",t=>`(1.0 / (1.0 + exp(-${t})))`))},Ou=e=>he(e),Ru=(e,t)=>{let r=Oe(e.inputs[0].dataType);e.compute(ce(e.inputs[0],"HardSigmoid",i=>`max(vec4<${r}>(0.0), min(vec4<${r}>(1.0), ${t.alpha} * ${i} + vec4<${r}>(${t.beta})))`,void 0,t.cacheKey))},Bu=e=>{e.compute(ce(e.inputs[0],"Sin","sin"))},Nu=e=>{e.compute(ce(e.inputs[0],"Sinh","sinh"))},Mu=e=>{e.compute(ce(e.inputs[0],"Sqrt","sqrt"))},Du=e=>{e.compute(ce(e.inputs[0],"Tan","tan"))},nn=e=>`sign(${e}) * (1 - exp(-2 * abs(${e}))) / (1 + exp(-2 * abs(${e})))`,Pu=e=>{e.compute(ce(e.inputs[0],"Tanh",nn))},an=(e="f32")=>`
const fast_gelu_a: ${e} = 0.5;
const fast_gelu_b: ${e} = 0.7978845608028654;
const fast_gelu_c: ${e} = 0.035677408136300125;

fn tanh_v(v: vec4<${e}>) -> vec4<${e}> {
  return ${nn("v")};
}
`,sn=e=>`(fast_gelu_a + fast_gelu_a * tanh_v(${e} * (fast_gelu_c * ${e} * ${e} + fast_gelu_b))) * ${e}`,Uu=e=>{let t=Oe(e.inputs[0].dataType);e.compute(ce(e.inputs[0],"FastGelu",sn,an(t),void 0,e.inputs[0].dataType))},qu=(e,t)=>{let r=Oe(e.inputs[0].dataType);return e.compute(ce(e.inputs[0],"ThresholdedRelu",i=>`select(vec4<${r}>(0.0), ${i}, ${i} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${r}>(${t.alpha});`,t.cacheKey)),0},Lu=e=>{e.compute(ce(e.inputs[0],"Log","log"))},Wu=(e,t)=>`
const alpha = vec4<${e}>(${t});
const one = ${e}(1.0);
const zero = ${e}(0.0);

fn quick_gelu_impl(x: vec4<${e}>) -> vec4<${e}> {
  let v = x *alpha;
  var x1 : vec4<${e}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,Vu=e=>`quick_gelu_impl(${e})`,Gu=(e,t)=>{let r=Oe(e.inputs[0].dataType);e.compute(ce(e.inputs[0],"QuickGelu",Vu,Wu(r,t.alpha),t.cacheKey,e.inputs[0].dataType))}}),Fu,Hu,ju,L_=U(()=>{ie(),ne(),on(),Fu=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![2560,5120,10240].includes(e[0].dims[2]))throw new Error("hidden state should be 2560, 5120 or 10240");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},Hu=e=>{let t=e[0].dims.slice();t[2]=t[2]/2;let r=N("input",e[0].dataType,e[0].dims,4),i=N("bias",e[0].dataType,[e[0].dims[2]],4),n=F("output",e[0].dataType,t,4),a=O.size(t)/4,s=ze(e[0].dataType);return{name:"BiasSplitGelu",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(a/64)}}),getShaderSource:u=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${e[0].dims[2]/4/2}u;

  ${u.declareVariables(r,i,n)}

  ${Ur(s)}

  ${u.mainStart()}
    ${u.guardAgainstOutOfBoundsWorkgroupSizes(a)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${n.setByOffset("global_idx","valueLeft * geluRight")}
  }`}},ju=e=>{Fu(e.inputs),e.compute(Hu(e.inputs))}}),Ku,Zu,Xe,Xu,Qu,Yu,Ju,el,tl,rl,il,nl,al,W_=U(()=>{te(),ie(),ne(),Ku=(e,t,r,i,n,a,s,u,l,d,c,f)=>{let g,_;typeof u=="string"?g=_=(b,z)=>`${u}((${b}),(${z}))`:typeof u=="function"?g=_=u:(g=u.scalar,_=u.vector);let y=F("outputData",c,i.length,4),$=N("aData",l,t.length,4),S=N("bData",d,r.length,4),x;if(n)if(a){let b=O.size(t)===1,z=O.size(r)===1,k=t.length>0&&t[t.length-1]%4===0,E=r.length>0&&r[r.length-1]%4===0;b||z?x=y.setByOffset("global_idx",_(b?`${$.type.value}(${$.getByOffset("0")}.x)`:$.getByOffset("global_idx"),z?`${S.type.value}(${S.getByOffset("0")}.x)`:S.getByOffset("global_idx"))):x=`
            let outputIndices = ${y.offsetToIndices("global_idx * 4u")};
            let offsetA = ${$.broadcastedIndicesToOffset("outputIndices",y)};
            let offsetB = ${S.broadcastedIndicesToOffset("outputIndices",y)};
            ${y.setByOffset("global_idx",_(s||k?$.getByOffset("offsetA / 4u"):`${$.type.value}(${$.getByOffset("offsetA / 4u")}[offsetA % 4u])`,s||E?S.getByOffset("offsetB / 4u"):`${S.type.value}(${S.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `}else x=y.setByOffset("global_idx",_($.getByOffset("global_idx"),S.getByOffset("global_idx")));else{if(!a)throw new Error("no necessary to use scalar implementation for element-wise binary op implementation.");let b=(z,k,E="")=>{let A=`aData[indexA${k}][componentA${k}]`,C=`bData[indexB${k}][componentB${k}]`;return`
            let outputIndices${k} = ${y.offsetToIndices(`global_idx * 4u + ${k}u`)};
            let offsetA${k} = ${$.broadcastedIndicesToOffset(`outputIndices${k}`,y)};
            let offsetB${k} = ${S.broadcastedIndicesToOffset(`outputIndices${k}`,y)};
            let indexA${k} = offsetA${k} / 4u;
            let indexB${k} = offsetB${k} / 4u;
            let componentA${k} = offsetA${k} % 4u;
            let componentB${k} = offsetB${k} % 4u;
            ${z}[${k}] = ${E}(${g(A,C)});
          `};c===9?x=`
            var data = vec4<u32>(0);
            ${b("data",0,"u32")}
            ${b("data",1,"u32")}
            ${b("data",2,"u32")}
            ${b("data",3,"u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:x=`
            ${b("outputData[global_idx]",0)}
            ${b("outputData[global_idx]",1)}
            ${b("outputData[global_idx]",2)}
            ${b("outputData[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables($,S,y)}

        ${f??""}

        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${x}
      }`},Zu=(e,t,r,i,n,a,s=r.dataType)=>{let u=r.dims.map(Number),l=i.dims.map(Number),d=!O.areEqual(u,l),c=u,f=O.size(u),g=!1,_=!1,y=[d];if(d){let $=Gt.calcShape(u,l,!1);if(!$)throw new Error("Can't perform binary op on the given tensors");c=$.slice(),f=O.size(c);let S=O.size(u)===1,x=O.size(l)===1,b=u.length>0&&u[u.length-1]%4===0,z=l.length>0&&l[l.length-1]%4===0;y.push(S),y.push(x),y.push(b),y.push(z);let k=1;for(let E=1;E<c.length;E++){let A=u[u.length-E],C=l[l.length-E];if(A===C)k*=A;else break}k%4===0?(_=!0,g=!0):(S||x||b||z)&&(g=!0)}else g=!0;return y.push(g),{name:e,shaderCache:{hint:t+y.map($=>$.toString()).join("_"),inputDependencies:["rank","rank"]},getShaderSource:$=>Ku($,u,l,c,g,d,_,n,r.dataType,i.dataType,s,a),getRunData:()=>({outputs:[{dims:c,dataType:s}],dispatchGroup:{x:Math.ceil(f/64/4)},programUniforms:[{type:12,data:Math.ceil(O.size(c)/4)},...K(u,l,c)]})}},Xe=(e,t,r,i,n,a)=>{e.compute(Zu(t,n??"",e.inputs[0],e.inputs[1],r,i,a))},Xu=e=>{Xe(e,"Add",(t,r)=>`${t}+${r}`)},Qu=e=>{Xe(e,"Div",(t,r)=>`${t}/${r}`)},Yu=e=>{Xe(e,"Equal",{scalar:(t,r)=>`u32(${t}==${r})`,vector:(t,r)=>`vec4<u32>(${t}==${r})`},void 0,void 0,9)},Ju=e=>{Xe(e,"Mul",(t,r)=>`${t}*${r}`)},el=e=>{let t=N("input",e.inputs[0].dataType,e.inputs[0].dims).type.value;Xe(e,"Pow",{scalar:(r,i)=>`pow_custom(${r},${i})`,vector:(r,i)=>`pow_vector_custom(${r},${i})`},`
    fn pow_custom(a : ${t}, b : ${t}) -> ${t} {
      if (b == ${t}(0.0)) {
        return ${t}(1.0);
      } else if (a < ${t}(0.0) && f32(b) != floor(f32(b))) {
        return ${t}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${t}(1.0), round(f32(abs(b) % ${t}(2.0))) != 1.0) * ${t}(${t==="i32"?"round":""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${t}>, b : vec4<${t}>) -> vec4<${t}> {
      // TODO: implement vectorized pow
      return vec4<${t}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},tl=e=>{Xe(e,"Sub",(t,r)=>`${t}-${r}`)},rl=e=>{Xe(e,"Greater",{scalar:(t,r)=>`u32(${t}>${r})`,vector:(t,r)=>`vec4<u32>(${t}>${r})`},void 0,void 0,9)},il=e=>{Xe(e,"Less",{scalar:(t,r)=>`u32(${t}<${r})`,vector:(t,r)=>`vec4<u32>(${t}<${r})`},void 0,void 0,9)},nl=e=>{Xe(e,"GreaterOrEqual",{scalar:(t,r)=>`u32(${t}>=${r})`,vector:(t,r)=>`vec4<u32>(${t}>=${r})`},void 0,void 0,9)},al=e=>{Xe(e,"LessOrEqual",{scalar:(t,r)=>`u32(${t}<=${r})`,vector:(t,r)=>`vec4<u32>(${t}<=${r})`},void 0,void 0,9)}}),sl,ol,ul,ll,dl,pl,V_=U(()=>{te(),ie(),ke(),ne(),sl=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");let r=0,i=e[r],n=i.dataType,a=i.dims.length;e.forEach((s,u)=>{if(u!==r){if(s.dataType!==n)throw new Error("input tensors should be one type");if(s.dims.length!==a)throw new Error("input tensors should have the same shape");s.dims.forEach((l,d)=>{if(d!==t&&l!==i.dims[d])throw new Error("non concat dimensions must match")})}})},ol=(e,t)=>`
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${e}u>(${t});
    for (var i: u32 = 0u; i < ${e}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${e}u;
  }`,ul=(e,t)=>{let r=e.length,i=[];for(let n=0;n<r;++n){let a=t.setByOffset("global_idx",e[n].getByIndices("indices"));r===1?i.push(a):n===0?i.push(`if (inputIndex == ${n}u) { ${a} }`):n===r-1?i.push(`else { ${a} }`):i.push(`else if (inputIndex == ${n}) { ${a} }`)}return i.join(`
`)},ll=(e,t,r,i)=>{let n=O.size(r),a=new Array(e.length),s=new Array(e.length),u=0,l=[],d=[],c=[{type:12,data:n}];for(let $=0;$<e.length;++$)u+=e[$].dims[t],a[$]=u,d.push(e[$].dims.length),s[$]=N(`input${$}`,i,d[$]),l.push("rank"),c.push({type:12,data:a[$]});for(let $=0;$<e.length;++$)c.push(...K(e[$].dims));c.push(...K(r));let f=F("output",i,r.length),g=f.indicesGet("indices",t),_=Array.from(Array(a.length).keys()).map($=>`uniforms.sizeInConcatAxis${$}`).join(","),y=$=>`

  ${(()=>{$.registerUniform("outputSize","u32");for(let S=0;S<e.length;S++)$.registerUniform(`sizeInConcatAxis${S}`,"u32");return $.declareVariables(...s,f)})()}

  ${ol(a.length,_)}

  ${$.mainStart()}
    ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    var indices = ${f.offsetToIndices("global_idx")};

    let inputIndex = calculateInputIndex(${g});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${a.length}u>(${_});
      ${g} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${ul(s,f)}
  }`;return{name:"Concat",shaderCache:{hint:`${t}`,inputDependencies:l},getRunData:()=>({outputs:[{dims:r,dataType:i}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:c}),getShaderSource:y}},dl=(e,t)=>{let r=e.inputs,i=r[0].dims,n=O.normalizeAxis(t.axis,i.length);sl(r,n);let a=i.slice();a[n]=r.reduce((u,l)=>u+(l.dims.length>n?l.dims[n]:0),0);let s=r.filter(u=>O.size(u.dims)>0);e.compute(ll(s,n,a,r[0].dataType),{inputs:s})},pl=e=>he({axis:e.axis})}),Ct,At,Ot,un,Rt=U(()=>{te(),ie(),Ct=(e,t,r="f32")=>{switch(e.activation){case"Relu":return`value = max(value, ${t}(0.0));`;case"Sigmoid":return`value = (${t}(1.0) / (${t}(1.0) + exp(-value)));`;case"Clip":return`value = clamp(value, ${t}(${r}(uniforms.clip_min)), ${t}(${r}(uniforms.clip_max)));`;case"HardSigmoid":return`value = max(${t}(0.0), min(${t}(1.0), ${r}(uniforms.alpha) * value + ${r}(uniforms.beta)));`;case"LeakyRelu":return`value = select(${r}(uniforms.alpha) * value, value, value >= ${t}(0.0));`;case"Tanh":return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case"":return"";default:throw new Error(`Unsupported activation ${e.activation}`)}},At=(e,t)=>{e.activation==="Clip"?t.push({type:1,data:e.clipMax},{type:1,data:e.clipMin}):e.activation==="HardSigmoid"?t.push({type:1,data:e.alpha},{type:1,data:e.beta}):e.activation==="LeakyRelu"&&t.push({type:1,data:e.alpha})},Ot=(e,t)=>{e.activation==="Clip"?t.push({name:"clip_max",type:"f32"},{name:"clip_min",type:"f32"}):e.activation==="HardSigmoid"?t.push({name:"alpha",type:"f32"},{name:"beta",type:"f32"}):e.activation==="LeakyRelu"&&t.push({name:"alpha",type:"f32"})},un=e=>{let t=e?.activation||"";if(t==="HardSigmoid"){let[r,i]=e?.activation_params||[.2,.5];return{activation:t,alpha:r,beta:i}}else if(t==="Clip"){let[r,i]=e?.activation_params||[Rs,Bs];return{activation:t,clipMax:i,clipMin:r}}else if(t==="LeakyRelu"){let[r]=e?.activation_params||[.01];return{activation:t,alpha:r}}return{activation:t}}}),Ie,cl,ln=U(()=>{Ie=(e,t)=>{switch(e){case 1:return t;case 2:return`vec2<${t}>`;case 3:return`vec3<${t}>`;case 4:return`vec4<${t}>`;default:throw new Error(`${e}-component is not supported.`)}},cl=e=>`
      ${e?"value = value + getBiasByOutputCoords(coords);":""}
      `}),hl,G_=U(()=>{hl=e=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${e}.x), i32(${e}.y), i32(${e}.z), 1));
}
`}),ur,dn,pn=U(()=>{te(),ie(),ne(),Rt(),ur=(e,t,r,i,n)=>{let a=i-r;return`
      ${Array.from({length:r}).map((s,u)=>`
      if (${j(t.shape,u,t.rank)} != 1) {
        ${t.indicesSet(e,u,j(n,u+a,i))}
      } else {
        ${t.indicesSet(e,u,0)}
      }`).join("")}
`},dn=(e,t,r,i,n=!1,a)=>{let s=e[0].dims,u=e[1].dims,l=s[s.length-2],d=u[u.length-1],c=s[s.length-1],f=xe(d),g=xe(c),_=xe(l),y=O.size(r)/f/_,$=e.length>2,S=i?i.slice(0,-2):r.slice(0,-2),x=[O.size(S),l,d],b=[{type:12,data:y},{type:12,data:l},{type:12,data:d},{type:12,data:c}];At(t,b),b.push(...K(S,s,u)),$&&b.push(...K(e[2].dims)),b.push(...K(x));let z=k=>{let E=Xi("batch_dims",e[0].dataType,S.length),A=N("a",e[0].dataType,s.length,g),C=N("b",e[1].dataType,u.length,f),v=F("output",e[0].dataType,x.length,f),D=ze(v.type.tensor),q=Ct(t,v.type.value,D),Q=[A,C],H="";if($){let M=n?f:1;Q.push(N("bias",e[2].dataType,e[2].dims.length,M)),H=`${n?`value += bias[col / ${M}];`:`value += ${v.type.value}(bias[row + i]);`}`}let Z=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"}];Ot(t,Z);let R=()=>{let M=`var a_data: ${A.type.value};`;for(let G=0;G<g;G++)M+=`
              let b_data${G} = b[(b_offset + (k + ${G}) * uniforms.N + col) / ${f}];`;for(let G=0;G<_;G++){M+=`a_data = a[(a_offset + (row + ${G}) * uniforms.K + k) / ${g}];`;for(let J=0;J<g;J++)M+=`
            values[${G}] = fma(${C.type.value}(a_data${g===1?"":`[${J}]`}), b_data${J}, values[${G}]);
`}return M};return`
  ${k.registerUniforms(Z).registerInternalVariables(E).declareVariables(...Q,v)}
  ${k.mainStart()}
    ${k.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${f})) * ${f};
    var index1 = global_idx / (uniforms.N / ${f});
    let stride1 = uniforms.M / ${_};
    let row = (index1 % stride1) * ${_};
    let batch = index1 / stride1;

    ${r.length===2?"":`let batch_indices = ${E.offsetToIndices("batch")};`}

    var a_indices: ${A.type.indices};
    ${ur("a_indices",A,A.rank-2,E.rank,"batch_indices")}
    ${A.indicesSet("a_indices",A.rank-2,0)}
    ${A.indicesSet("a_indices",A.rank-1,0)}
    let a_offset = ${A.indicesToOffset("a_indices")};

    var b_indices: ${C.type.indices};
    ${ur("b_indices",C,C.rank-2,E.rank,"batch_indices")}
    ${C.indicesSet("b_indices",C.rank-2,0)}
    ${C.indicesSet("b_indices",C.rank-1,0)}
    let b_offset = ${C.indicesToOffset("b_indices")};
    var values: array<${v.type.value}, ${_}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${g}) {
      ${R()}
    }
    for (var i = 0u; i < ${_}u; i++) {
      var value = values[i];
      ${H}
      ${q}
      let cur_indices = ${v.type.indices}(batch, row + i, col);
      let offset = ${v.indicesToOffset("cur_indices")};
      ${v.setByOffset(`offset / ${f}`,"value")};
    }
  }
  `};return{name:"MatMulNaive",shaderCache:{hint:`${t.activation};${f};${g};${_};${n}`,inputDependencies:$?["rank","rank","rank"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:a?a(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(y/64)},programUniforms:b}),getShaderSource:z}}}),fl,ml,cn,hn,gl,fn,_l,qr,mn=U(()=>{te(),ie(),ne(),Rt(),pn(),ln(),fl=(e,t)=>e?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${t?", batchIndices":""});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${t?", batchIndices":""});
        `,ml=(e,t)=>e?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${t===3?"":"let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached.w + acc[i];"}
        }`,cn=(e,t,r="f32",i,n=!1,a=32,s=!1,u=32)=>{let l=t[1]*e[1],d=t[0]*e[0],c=n?l:a,f=n?a:l,g=c/t[0],_=a/t[1];if(!((n&&g===4&&e[1]===4||!n&&(g===3||g===4))&&c%t[0]===0&&a%t[1]===0&&e[0]===4))throw new Error(`If transposeA ${n} is true, innerElementSize ${g} and workPerThread[1] ${e[1]} must be 4.
      Otherwise, innerElementSize ${g} must be 3 or 4.
  tileAWidth ${c} must be divisible by workgroupSize[0]${t[0]}. tileInner ${a} must be divisible by workgroupSize[1] ${t[1]}. colPerThread ${e[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${g}<${r}>, ${c/g}>, ${f}>;
var<workgroup> mm_Bsub: array<array<vec4<${r}>, ${d/e[0]}>, ${a}>;

const rowPerThread = ${e[1]};
const colPerThread = ${e[0]};
const innerElementSize = ${g};
const tileInner = ${a};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${s?"0":"i32(globalId.z)"};
  ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
  let globalRowStart = i32(workgroupId.y) * ${l};

  let num_tiles = ${s?`${Math.ceil(u/a)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${s?`i32(globalId.z) * ${u}`:"0"};

  var acc: array<vec4<${r}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${_};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${fl(n,i)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${_}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${i?", batchIndices":""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${g===3?"":"let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${ml(n,g)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},hn=(e,t)=>e?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${t?", batchIndices":""});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${t?", batchIndices":""});
            `,gl=e=>e?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];",fn=(e,t,r="f32",i,n=!1,a=32,s=!1,u=32,l=!1)=>{let d=e[1]*t[1],c=e[0]*t[0],f=n?d:a,g=n?a:d;if(!(g%t[1]===0&&f%t[0]===0&&a%t[1]===0))throw new Error(`tileAHight ${g} must be divisible by workgroupSize[1]${t[1]}, tileAWidth ${f} must be divisible by workgroupSize[0]${t[0]}, tileInner ${a} must be divisible by workgroupSize[1]${t[1]}`);let _=g/t[1],y=f/t[0],$=a/t[1],S=l?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${d};
    let globalColStart = i32(workgroupId.x) * ${c};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${g}; inputRow = inputRow + ${t[1]}) {
        for (var inputCol = localCol; inputCol < ${f}; inputCol = inputCol + ${t[0]}) {
          ${hn(n,i)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${a}; inputRow = inputRow + ${t[1]}) {
            for (var inputCol = localCol; inputCol < ${c}; inputCol = inputCol + ${t[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${i?", batchIndices":""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${r}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${t[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${n?`mm_Asub[k][localRow + innerRow * ${t[1]}];`:`mm_Asub[localRow + innerRow * ${t[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${t[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${t[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${d};

let tileRowA = i32(localId.y) * ${_};
let tileColA = i32(localId.x) * ${y};
let tileRowB = i32(localId.y) * ${$};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${_}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${y}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${hn(n,i)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${$}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${i?", batchIndices":""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${r}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${gl(n)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${r}, ${f}>, ${g}>;
  var<workgroup> mm_Bsub : array<array<${r}, ${c}>, ${a}>;
  const rowPerThread = ${e[1]};
  const colPerThread = ${e[0]};
  const tileInner = ${a};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${s?"0":"i32(globalId.z)"};
    ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
    let num_tiles = ${s?`${Math.ceil(u/a)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${s?`i32(globalId.z) * ${u}`:"0"};

    var acc : array<array<${r}, colPerThread>, rowPerThread>;
    ${S}
  }
`},_l=(e,t,r,i,n=!1)=>{let[a,s,u,l]=i,d=ze(i[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${a.type.indices}) -> ${Ie(e,d)} {
      var value = ${Ie(e,d)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${s.type.indices};
        ${ur("aIndices",s,s.rank-2,a.rank,"batchIndices")}
        ${s.indicesSet("aIndices",s.rank-2,"u32(row)")}
        ${s.indicesSet("aIndices",s.rank-1,"u32(colIn)")}
        value = ${s.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${a.type.indices}) -> ${Ie(e,d)} {
      var value = ${Ie(e,d)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${u.type.indices};
        ${ur("bIndices",u,u.rank-2,a.rank,"batchIndices")}
        ${u.indicesSet("bIndices",u.rank-2,"u32(row)")}
        ${u.indicesSet("bIndices",u.rank-1,"u32(colIn)")}
        value = ${u.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${Ie(e,d)}) {
      let col = colIn * ${e};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${t?`value = value + ${n?"bias[colIn]":`${Ie(e,d)}(bias[row])`};`:""}
        ${r}
        ${l.setByIndices("vec3<u32>(coords)","value")}
      }
    }
    `},qr=(e,t,r,i,n=!1,a)=>{let s=e[0].dims,u=e[1].dims,l=s.slice(0,-2),d=u.slice(0,-2),c=i?i.slice(0,-2):r.slice(0,-2),f=O.size(c),g=s[s.length-2],_=s[s.length-1],y=u[u.length-1],$=_%4===0&&y%4===0,S=g<=8?[4,1,1]:[4,4,1],x=[8,8,1],b=[Math.ceil(y/x[0]/S[0]),Math.ceil(g/x[1]/S[1]),Math.ceil(f/x[2]/S[2])],z=$?4:1,k=[...l,g,_/z],E=k.length,A=[...d,_,y/z],C=A.length,v=[f,g,y/z],D=[{type:6,data:g},{type:6,data:y},{type:6,data:_}];At(t,D),D.push(...K(c,k,A));let q=["rank","rank"],Q=e.length>2;Q&&(D.push(...K(e[2].dims)),q.push("rank")),D.push(...K(v));let H=Z=>{let R=c.length,M=Xi("batchDims",e[0].dataType,R,1),G=ze(e[0].dataType),J=N("a",e[0].dataType,E,z),ee=N("b",e[1].dataType,C,z),re=F("result",e[0].dataType,v.length,z),ae=[J,ee];if(Q){let Te=n?z:1;ae.push(N("bias",e[2].dataType,e[2].dims.length,Te))}let P=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"}];Ot(t,P);let Y=ze(re.type.tensor),X=Ct(t,re.type.value,Y),V=_l(z,Q,X,[M,J,ee,re],n);return`
  ${Z.registerUniforms(P).registerInternalVariables(M).declareVariables(...ae,re)}
  ${V}
  ${$?cn(S,x,G,M):fn(S,x,G,M)}
                   `};return{name:"MatMul",shaderCache:{hint:`${S};${t.activation};${$};${n}`,inputDependencies:q},getRunData:()=>({outputs:[{dims:a?a(r):r,dataType:e[0].dataType}],dispatchGroup:{x:b[0],y:b[1],z:b[2]},programUniforms:D}),getShaderSource:H}}}),yl,bl,F_=U(()=>{te(),ot(),ne(),Rt(),ln(),G_(),mn(),yl=(e,t,r,i,n=!1,a,s=4,u=4,l=4,d="f32")=>{let c=D=>{switch(D){case 1:return"resData = x[xIndex];";case 3:return`resData = vec3<${d}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return"resData = x[xIndex / 4];";default:throw new Error(`innerElementSize ${D} is not supported.`)}},f=D=>{switch(D){case 1:return"return w[row * i32(uniforms.w_shape[3]) + colIn];";case 4:return"return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";default:throw new Error(`innerElementSize ${D} is not supported.`)}},g=e?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,_=e?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,y=e?"i32(uniforms.x_shape[1])":"i32(uniforms.x_shape[2])",$=e?"i32(uniforms.x_shape[2])":"i32(uniforms.x_shape[3])",S=e?"row":"col",x=e?"col":"row",b=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
    let outRow = ${S} / outWidth;
    let outCol = ${S} % outWidth;

    let WRow = ${x} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${x} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${x} % inChannels;
    var resData = ${Ie(s,d)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${y} && xCol >= 0 && xCol < ${$}) {
      ${g}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${c(s)}
    }
    return resData;`,z=e?t&&i?`
    let col = colIn * ${s};
    ${b}`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${b}
    }
    return ${Ie(s,d)}(0.0);`:i&&r?`
    let col = colIn * ${s};
    ${b}`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${b}
    }
    return ${Ie(s,d)}(0.0);`,k=e?i&&r?f(u):`
    let col = colIn * ${u};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${f(u)}
    }
    return ${Ie(u,d)}(0.0);`:`
    let col = colIn * ${u};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${f(u)}
    }
    return ${Ie(u,d)}(0.0);`,E=Ie(l,d),A=Ie(e?s:u,d),C=Ie(e?u:s,d),v=Ct(a,E,d);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${A} {
      ${e?z:k}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${C} {
      ${e?k:z}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${E}) {
      let col = colIn * ${l};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
      ${_}
      ${cl(n)}
      ${v}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},bl=(e,t,r,i,n,a,s,u,l)=>{let d=t.format==="NHWC",c=d?e[0].dims[3]:e[0].dims[1],f=r[0],g=d?r[2]:r[3],_=d?r[1]:r[2],y=d?r[3]:r[1],$=d&&(c%4===0||c%3===0)&&y%4===0,S=d?y:g*_,x=d?g*_:y,b=[8,8,1],z=i<=8?[4,1,1]:[4,4,1],k=[Math.ceil(S/b[0]/z[0]),Math.ceil(x/b[1]/z[1]),Math.ceil(f/b[2]/z[2])];de("verbose",()=>`[conv2d_mm_webgpu] dispatch = ${k}`);let E=$?d&&c%4!==0?3:4:1,A=b[1]*z[1],C=b[0]*z[0],v=Math.max(b[0]*E,b[1]),D=i%A===0,q=n%C===0,Q=a%v===0,H=$?[E,4,4]:[1,1,1],Z=[{type:6,data:i},{type:6,data:n},{type:6,data:a},{type:6,data:[t.pads[0],t.pads[1]]},{type:6,data:t.strides},{type:6,data:t.dilations}];At(t,Z),Z.push(...K(e[0].dims,e[1].dims));let R=["rank","rank"];s&&(Z.push(...K(e[2].dims)),R.push("rank")),Z.push(...K(r));let M=G=>{let J=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"},{name:"pad",type:"i32",length:2},{name:"stride",type:"i32",length:2},{name:"dilation",type:"i32",length:2}];Ot(t,J);let ee=$?4:1,re=ze(e[0].dataType),ae=`
      fn setOutputAtIndex(flatIndex : i32, value : ${$?`vec4<${re}>`:re}) {
        result[flatIndex] = ${$?`vec4<${re}>`:re}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${$?`vec4<${re}>`:re}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${$?"/ 4":""}, value);
      }`,P=N("x",e[0].dataType,e[0].dims.length,E===3?1:E),Y=N("w",e[1].dataType,e[1].dims.length,ee),X=[P,Y],V=F("result",e[0].dataType,r.length,ee);if(s){let Te=N("bias",e[2].dataType,e[2].dims.length,ee);X.push(Te),ae+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${$?`vec4<${re}>`:re} {
          return bias[coords.${d?"w":"y"}${$?"/ 4":""}];
        }`}return`
        ${hl("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${G.registerUniforms(J).declareVariables(...X,V)}
        ${ae}
        ${yl(d,D,q,Q,s,t,H[0],H[1],H[2],re)}
        ${$?cn(z,b,re,void 0,!d,v):fn(z,b,re,void 0,!d,v,!1,void 0,u)}`};return{name:"Conv2DMatMul",shaderCache:{hint:`${t.cacheKey};${E};${$};${D};${q};${Q};${A};${C};${v}`,inputDependencies:R},getRunData:()=>({outputs:[{dims:l?l(r):r,dataType:e[0].dataType}],dispatchGroup:{x:k[0],y:k[1],z:k[2]},programUniforms:Z}),getShaderSource:M}}}),wl,gn,lr,$l,_n,vl,xl,kl,H_=U(()=>{te(),ot(),ie(),ne(),Rt(),ln(),wl=e=>{let t=1;for(let r=0;r<e.length;r++)t*=e[r];return t},gn=e=>typeof e=="number"?[e,e,e]:e,lr=(e,t)=>t<=1?e:e+(e-1)*(t-1),$l=(e,t,r,i=1)=>{let n=lr(t,i);return Math.floor((e[0]*(r-1)-r+n)/2)},_n=(e,t,r,i,n)=>{n==null&&(n=$l(e,t[0],i[0]));let a=[0,0,0,r];for(let s=0;s<3;s++)e[s]+2*n>=t[s]&&(a[s]=Math.trunc((e[s]-t[s]+2*n)/i[s]+1));return a},vl=(e,t,r,i,n,a,s,u,l,d)=>{let c,f,g,_;if(e==="VALID"&&(e=0),typeof e=="number"){c={top:e,bottom:e,left:e,right:e,front:e,back:e};let y=_n([t,r,i,1],[u,l,d],1,[n,a,s],e);f=y[0],g=y[1],_=y[2]}else if(Array.isArray(e)){if(!e.every(($,S,x)=>$===x[0]))throw Error(`Unsupported padding parameter: ${e}`);c={top:e[0],bottom:e[1],left:e[2],right:e[3],front:e[4],back:e[5]};let y=_n([t,r,i,1],[u,l,d],1,[n,a,s],e[0]);f=y[0],g=y[1],_=y[2]}else if(e==="SAME_UPPER"){f=Math.ceil(t/n),g=Math.ceil(r/a),_=Math.ceil(i/s);let y=(f-1)*n+u-t,$=(g-1)*a+l-r,S=(_-1)*s+d-i,x=Math.floor(y/2),b=y-x,z=Math.floor($/2),k=$-z,E=Math.floor(S/2),A=S-E;c={top:z,bottom:k,left:E,right:A,front:x,back:b}}else throw Error(`Unknown padding parameter: ${e}`);return{padInfo:c,outDepth:f,outHeight:g,outWidth:_}},xl=(e,t,r,i,n,a=!1,s="channelsLast")=>{let u,l,d,c,f;if(s==="channelsLast")[u,l,d,c,f]=e;else if(s==="channelsFirst")[u,f,l,d,c]=e;else throw new Error(`Unknown dataFormat ${s}`);let[g,,_,y,$]=t,[S,x,b]=gn(r),[z,k,E]=gn(i),A=lr(_,z),C=lr(y,k),v=lr($,E),{padInfo:D,outDepth:q,outHeight:Q,outWidth:H}=vl(n,l,d,c,S,x,b,A,C,v),Z=a?g*f:g,R=[0,0,0,0,0];return s==="channelsFirst"?R=[u,Z,q,Q,H]:s==="channelsLast"&&(R=[u,q,Q,H,Z]),{batchSize:u,dataFormat:s,inDepth:l,inHeight:d,inWidth:c,inChannels:f,outDepth:q,outHeight:Q,outWidth:H,outChannels:Z,padInfo:D,strideDepth:S,strideHeight:x,strideWidth:b,filterDepth:_,filterHeight:y,filterWidth:$,effectiveFilterDepth:A,effectiveFilterHeight:C,effectiveFilterWidth:v,dilationDepth:z,dilationHeight:k,dilationWidth:E,inShape:e,outShape:R,filterShape:t}},kl=(e,t,r,i,n,a)=>{let s=a==="channelsLast";s?e[0].dims[3]:e[0].dims[1];let u=[64,1,1],l={x:r.map((S,x)=>x)},d=[Math.ceil(wl(l.x.map(S=>r[S]))/u[0]),1,1];de("verbose",()=>`[conv3d_naive_webgpu] dispatch = ${d}`);let c=1,f=O.size(r),g=[{type:12,data:f},{type:12,data:i},{type:12,data:n},{type:12,data:t.strides},{type:12,data:t.dilations}];At(t,g),g.push(...K(e[0].dims,e[1].dims));let _=["rank","rank"],y=e.length===3;y&&(g.push(...K(e[2].dims)),_.push("rank")),g.push(...K(r));let $=S=>{let x=[{name:"output_size",type:"u32"},{name:"filter_dims",type:"u32",length:i.length},{name:"pads",type:"u32",length:n.length},{name:"strides",type:"u32",length:t.strides.length},{name:"dilations",type:"u32",length:t.dilations.length}];Ot(t,x);let b=1,z=ze(e[0].dataType),k=N("x",e[0].dataType,e[0].dims.length,c),E=N("W",e[1].dataType,e[1].dims.length,b),A=[k,E],C=F("result",e[0].dataType,r.length,b),v="";if(y){let Q=N("bias",e[2].dataType,e[2].dims.length,b);A.push(Q),v+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${z} {
          return bias[${s?j("coords",4,5):j("coords",1,5)}];
        }`}let D=Ie(c,z),q=Ct(t,D,z);return`
            ${v}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${k.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${E.getByIndices("aIndices")};
            }
          ${S.registerUniforms(x).declareVariables(...A,C)}
          ${S.mainStart()}
          ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${C.offsetToIndices("global_idx")};
              let batch = ${j("coords",0,k.rank)};
              let d2 = ${s?j("coords",k.rank-1,k.rank):j("coords",1,k.rank)};
              let xFRCCorner = vec3<u32>(${s?j("coords",1,k.rank):j("coords",2,k.rank)},
              ${s?j("coords",2,k.rank):j("coords",3,k.rank)},
              ${s?j("coords",3,k.rank):j("coords",4,k.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${s?j("uniforms.x_shape",1,k.rank):j("uniforms.x_shape",2,k.rank)};
              let xShapeZ = ${s?j("uniforms.x_shape",2,k.rank):j("uniforms.x_shape",3,k.rank)};
              let xShapeW = ${s?j("uniforms.x_shape",3,k.rank):j("uniforms.x_shape",4,k.rank)};
              let xShapeU = ${s?j("uniforms.x_shape",4,k.rank):j("uniforms.x_shape",1,k.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = 0.0;
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${s?`let xValues = vec4<f32>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<f32>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<f32>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${s?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${s?`let xValues = vec2<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${s?`let xValues = vec3<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${y?"value = value + getBiasByOutputCoords(coords)":""};
              ${q}
              result[global_idx] = f32(value);
          }`};return{name:"Conv3DNaive",shaderCache:{hint:`${t.cacheKey};${s};${c};${y}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:d[0],y:d[1],z:d[2]},programUniforms:g}),getShaderSource:$}}}),Sl,Tl,j_=U(()=>{te(),ie(),ne(),Rt(),Sl=(e,t,r,i)=>{let n=e.length>2,a=n?"value += b[output_channel];":"",s=e[0].dims,u=e[1].dims,l=t.format==="NHWC",d=l?r[3]:r[1],c=d/t.group,f=l&&c>=4?xe(d):1,g=O.size(r)/f,_=[{type:12,data:g},{type:12,data:t.dilations},{type:12,data:[t.strides[0],t.strides[1]]},{type:12,data:[t.pads[0],t.pads[1]]},{type:12,data:c}];At(t,_),_.push(...K(s,[u[0],u[1],u[2],u[3]/f]));let y=n?["rank","rank","rank"]:["rank","rank"];_.push(...K([r[0],r[1],r[2],r[3]/f]));let $=S=>{let x=F("output",e[0].dataType,r.length,f),b=ze(x.type.tensor),z=Ct(t,x.type.value,b),k=N("x",e[0].dataType,s.length),E=N("w",e[1].dataType,u.length,f),A=[k,E];n&&A.push(N("b",e[2].dataType,e[2].dims,f));let C=[{name:"output_size",type:"u32"},{name:"dilations",type:"u32",length:t.dilations.length},{name:"strides",type:"u32",length:2},{name:"pads",type:"u32",length:2},{name:"output_channels_per_group",type:"u32"}];Ot(t,C);let v=l?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${k.get("batch","xHeight","xWidth","input_channel")};
            let wVal = ${E.get("wHeight","wWidth","wInChannel","output_channel")};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${k.get("batch","input_channel","xHeight","xWidth")};
            let wVal = ${E.get("output_channel","wInChannel","wHeight","wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${S.registerUniforms(C).declareVariables(...A,x)}

  ${S.mainStart()}
    ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${x.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${l?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${l?1:2}], outputIndices[${l?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${f} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${l?2:1}];

    var value: ${x.type.value} = ${x.type.value}(0);
    ${v}
    ${a}
    ${z}
    ${x.setByOffset("global_idx","value")}
  }`};return{name:"GroupedConv",shaderCache:{hint:`${t.cacheKey}_${f}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:_}),getShaderSource:$}},Tl=(e,t,r,i)=>{let n=e.length>2,a=xe(r[3]),s=xe(r[2]),u=O.size(r)/a/s,l=[e[0].dims[0],e[0].dims[1],e[0].dims[2],e[0].dims[3]/a],d=[e[1].dims[0],e[1].dims[1],e[1].dims[2],e[1].dims[3]/a],c=[r[0],r[1],r[2],r[3]/a],f=[{type:12,data:u},{type:6,data:[t.strides[0],t.strides[1]]},{type:6,data:[t.pads[0],t.pads[1]]}];At(t,f),f.push(...K(l,d,c));let g=(s-1)*t.strides[1]+d[1],_=y=>{let $=F("output",e[0].dataType,c.length,a),S=ze($.type.tensor),x=Ct(t,$.type.value,S),b=N("x",e[0].dataType,l.length,a),z=N("w",e[1].dataType,d.length,a),k=[b,z];n&&k.push(N("b",e[2].dataType,e[2].dims,a));let E=n?"value += b[output_channel];":"",A=[{name:"output_size",type:"u32"},{name:"strides",type:"i32",length:2},{name:"pads",type:"i32",length:2}];return Ot(t,A),`
  ${y.registerUniforms(A).declareVariables(...k,$)}
  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${s}u;
    let col = (index1 % width1) * ${s}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${b.type.value}, ${g}>;
    var values: array<${$.type.value}, ${s}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${d[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${g}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${b.get("batch","u32(x_height)","u32(x_width)","input_channel")};
          } else {
            x_vals[i] = ${b.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${d[1]}; w_width++) {
          let w_val = ${z.get("w_height","w_width","0","output_channel")};
          for (var i = 0u; i < ${s}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${s}u; i++) {
      var value = values[i];
      ${E}
      ${x}
      ${$.set("batch","row","col + i","output_channel","value")};
    }
  }`};return{name:"GroupedConv-Vectorize",shaderCache:{hint:`${t.cacheKey};${a};${s};${g};${d[0]};${d[1]}`,inputDependencies:n?["rank","rank","type"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:f}),getShaderSource:_}}}),zl,Lr,El,Wr,yn,bn,Il,Cl,wn,K_=U(()=>{ie(),F_(),H_(),mn(),j_(),Rt(),pn(),ft(),zl=(e,t,r,i,n,a)=>{let s=e[0],u=e.slice(a?1:2,a?3:4),l=u.length,d=t[0],c=t.slice(2).map((g,_)=>g+(g-1)*(r[_]-1)),f=u.map((g,_)=>g+i[_]+i[_+l]).map((g,_)=>Math.floor((g-c[_]+n[_])/n[_]));return f.splice(0,0,s),f.splice(a?3:1,0,d),f},Lr=[2,3,1,0],El=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length>5)throw new Error("greater than 5D is not supported");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[1]*t.group;if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");if(e.length===3&&(e[2].dims.length!==1||e[1].dims[0]!==e[2].dims[0]))throw new Error("invalid bias");let n=e[0].dims.length-2;if(t.dilations.length!==n)throw new Error(`dilations should be ${n}D`);if(t.strides.length!==n)throw new Error(`strides should be ${n}D`);if(t.pads.length!==n*2)throw new Error(`pads should be ${n*2}D`);if(t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape")},Wr=(e,t)=>{let r=e.kernelShape.slice();r.length<t[1].dims.length-2&&r.push(...Array(t[1].dims.length-2-r.length).fill(0));for(let a=2;a<t[1].dims.length;++a)r[a-2]===0&&(r[a-2]=t[1].dims[a]);let i=e.pads.slice();Rr.adjustPadsBasedOnAutoPad(t[0].dims,e.strides,e.dilations,r,i,e.format==="NHWC",e.autoPad);let n=Object.assign({},e);return Object.assign(n,{kernelShape:r,pads:i}),n},yn=e=>{let t=un(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],n=e.dilations,a=e.group,s=e.kernel_shape,u=e.pads,l=e.strides,d=e.w_is_const();return{autoPad:i,format:r,dilations:n,group:a,kernelShape:s,pads:u,strides:l,wIsConst:d,...t,cacheKey:`${e.format};${t.activation};`}},bn=(e,t,r,i)=>{let n=r.format==="NHWC",a=zl(t[0].dims,t[1].dims,r.dilations,r.pads,r.strides,n);if(r.group!==1){let A=[t[0]];if(n){let C=e.kernelCustomData.wT??e.compute(Pe(t[1],Lr),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=C),A.push(C)}else A.push(t[1]);t.length===3&&A.push(t[2]),!e.adapterInfo.isArchitecture("ampere")&&n&&t[1].dims[0]===r.group&&t[1].dims[1]===1&&r.dilations[0]===1&&r.dilations[1]===1?e.compute(Tl(A,r,a,i),{inputs:A}):e.compute(Sl(A,r,a,i),{inputs:A});return}let s=t.length===3,u=t[0].dims[n?1:2],l=t[0].dims[n?2:3],d=t[0].dims[n?3:1],c=t[1].dims[2],f=t[1].dims[3],g=a[n?1:2],_=a[n?2:3],y=a[n?3:1],$=n&&c===u&&f===l&&r.pads[0]===0&&r.pads[1]===0;if($||c===1&&f===1&&r.dilations[0]===1&&r.dilations[1]===1&&r.strides[0]===1&&r.strides[1]===1&&r.pads[0]===0&&r.pads[1]===0){let A=a[0],C,v,D,q=[];if(n){let Z=e.kernelCustomData.wT??e.compute(Pe(t[1],Lr),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];if(r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=Z),$){let R=u*l*d;C=t[0].reshape([1,A,R]),v=Z.reshape([1,R,y]),D=[1,A,y]}else C=t[0].reshape([A,u*l,d]),v=Z.reshape([1,d,y]),D=[A,g*_,y];q.push(C),q.push(v)}else C=t[0].reshape([A,d,u*l]),v=t[1].reshape([1,y,d]),D=[A,y,g*_],q.push(v),q.push(C);s&&q.push(t[2]);let Q=D[2],H=q[0].dims[q[0].dims.length-1];Q<8&&H<8?e.compute(dn(q,r,a,D,n,i),{inputs:q}):e.compute(qr(q,r,a,D,n,i),{inputs:q});return}let S=!0,x=e.kernelCustomData.wT??e.compute(Pe(t[1],Lr),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=x);let b=[t[0],x];s&&b.push(t[2]);let z=n?g*_:y,k=n?y:g*_,E=c*f*d;e.compute(bl(b,r,a,z,k,E,s,S,i),{inputs:b})},Il=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let n=[0,t.pads[0],0,t.pads[1]],a=[1].concat(t.strides),s=[1].concat(t.dilations),u=[1].concat(t.kernelShape),l=Wr({...t,pads:n,strides:a,dilations:s,kernelShape:u},i);bn(e,i,l,d=>r?[d[0],d[2],d[3]]:[d[0],d[1],d[3]])},Cl=(e,t,r)=>{let i=r.format==="NHWC"?"channelsLast":"channelsFirst",n=Wr(r,t),a=r.autoPad==="NOTSET"?r.pads:r.autoPad,s=xl(t[0].dims,t[1].dims,r.strides,r.dilations,a,!1,i);e.compute(kl(t,n,s.outShape,[s.filterDepth,s.filterHeight,s.filterWidth],[s.padInfo.front,s.padInfo.top,s.padInfo.left],i))},wn=(e,t)=>{if(El(e.inputs,t),e.inputs[0].dims.length===3)Il(e,t);else if(e.inputs[0].dims.length===5)Cl(e,e.inputs,t);else{let r=Wr(t,e.inputs);bn(e,e.inputs,r)}}}),Al,Z_=U(()=>{te(),ot(),ie(),ne(),Al=(e,t,r)=>{let i=e.length>2,n=t.outputShape,a=t.format==="NHWC",s=t.group,u=e[1].dims,l=u[2]/s,d=u[3],c=a?xe(l):1,f=a&&d===1&&l>=4,g=f?Math.floor(l/4)*4:Math.floor(l/c)*c,_=l-g,y=a?xe(d):1,$=a?d===1?c:y:1,S=O.size(n)/y,x=[Math.ceil(S/64),1,1];de("verbose",()=>`[conv2d_backprop_webgpu] dispatch = ${x}`);let b=["rank","rank"],z=[t.strides[0],t.strides[1]],k=[t.kernelShape[a?1:2],t.kernelShape[a?2:3]],E=[t.dilations[0],t.dilations[1]],A=[k[0]+(t.dilations[0]<=1?0:(t.kernelShape[a?1:2]-1)*(t.dilations[0]-1)),k[1]+(t.dilations[1]<=1?0:(t.kernelShape[a?2:3]-1)*(t.dilations[1]-1))],C=[A[0]-1-Math.floor((t.pads[0]+t.pads[2])/2),A[1]-1-Math.floor((t.pads[1]+t.pads[3])/2)],v=[{type:12,data:S},{type:12,data:z},{type:12,data:k},{type:12,data:E},{type:12,data:A},{type:6,data:C},{type:12,data:g},{type:12,data:l},{type:12,data:d},...K(e[0].dims,e[1].dims)];i&&(v.push(...K(e[2].dims)),b.push("rank")),v.push(...K(n));let D=q=>{let Q=[{name:"output_size",type:"u32"},{name:"strides",type:"u32",length:z.length},{name:"filter_dims",type:"u32",length:k.length},{name:"dilations",type:"u32",length:k.length},{name:"effective_filter_dims",type:"u32",length:A.length},{name:"pads",type:"i32",length:C.length},{name:"input_channels_per_group_int",type:"u32"},{name:"input_channels_per_group",type:"u32"},{name:"output_channels_per_group",type:"u32"}],H=ze(e[0].dataType),Z=a?1:2,R=a?2:3,M=a?3:1,G=N("W",e[1].dataType,e[1].dims.length,$),J=N("Dy",e[0].dataType,e[0].dims.length,c),ee=[J,G];i&&ee.push(N("bias",e[2].dataType,[n[M]].length,y));let re=F("result",e[0].dataType,n.length,y),ae=()=>{let X="";if(f)c===4?X+=`
        let xValue = ${J.getByOffset("x_offset")};
        let wValue = ${G.getByOffset("w_offset")};
        dotProd = dotProd + dot(xValue, wValue);
        x_offset += 1u;
        w_offset += 1u;`:c===2?X+=`
          dotProd = dotProd + dot(vec4<${H}>(${J.getByOffset("x_offset")}, ${J.getByOffset("x_offset + 1u")}), vec4<${H}>(${G.getByOffset("w_offset")}, ${G.getByOffset("w_offset + 1u")}));
          x_offset += 2u;
          w_offset += 2u;`:c===1&&(X+=`
          dotProd = dotProd + dot(vec4<${H}>(${J.getByOffset("x_offset")}, ${J.getByOffset("x_offset + 1u")}, ${J.getByOffset("x_offset + 2u")}, ${J.getByOffset("x_offset + 3u")}), vec4<${H}>(${G.getByOffset("w_offset")}, ${G.getByOffset("w_offset + 1u")}, ${G.getByOffset("w_offset + 2u")}, ${G.getByOffset("w_offset + 3u")}));
          x_offset += 4u;
          w_offset += 4u;`);else if(X+=`
                  let xValue = ${a?J.getByOffset(`${J.indicesToOffset(`${J.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${c}`):J.get("batch","inputChannel","idyR","idyC")};
        `,c===1)X+=`
          let w_offset = ${G.indicesToOffset(`${G.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
          let wValue = ${G.getByOffset(`w_offset / ${$}`)};
          dotProd = dotProd + xValue * wValue;`;else for(let V=0;V<c;V++)X+=`
            let wValue${V} = ${G.getByOffset(`${G.indicesToOffset(`${G.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${V}, wOutChannel)`)} / ${$}`)};
            dotProd = dotProd + xValue[${V}] * wValue${V};`;return X},P=()=>{if(_===0)return"";if(!f)throw new Error(`packInputAs4 ${f} is not true.`);let X="";if(c===1){X+="dotProd = dotProd";for(let V=0;V<_;V++)X+=`
            + ${J.getByOffset(`x_offset + ${V}`)} * ${G.getByOffset(`w_offset + ${V}`)}`;X+=";"}else if(c===2){if(_!==2)throw new Error(`Invalid inputChannelsRemainder ${_}.`);X+=`
          let xValue = ${J.getByOffset("x_offset")};
          let wValue = ${G.getByOffset("w_offset")};
          dotProd = dotProd + dot(xValue, wValue);`}return X},Y=`
            let outputIndices = ${re.offsetToIndices(`global_idx * ${y}`)};
            let batch = ${re.indicesGet("outputIndices",0)};
            let d1 = ${re.indicesGet("outputIndices",M)};
            let r = ${re.indicesGet("outputIndices",Z)};
            let c = ${re.indicesGet("outputIndices",R)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${re.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${H}(dyRCorner) + ${H}(wR)) / ${H}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${H}(uniforms.Dy_shape[${Z}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }
              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${H}(dyCCorner) + ${H}(wC)) / ${H}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${H}(uniforms.Dy_shape[${R}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                ${f?`
                var x_offset = ${J.indicesToOffset(`${J.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${c};
                var w_offset = ${G.indicesToOffset(`${G.type.indices}(wRPerm, wCPerm, inputChannel, wOutChannel)`)} / ${$};
                  `:""}
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group_int; d2 = d2 + ${f?4:c}) {
                  ${ae()}
                  inputChannel = inputChannel + ${f?4:c};
                }
                ${P()}
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${i?` + bias[d1 / ${y}]`:""};
            ${re.setByOffset("global_idx","value")};
          `;return`
    ${q.registerUniforms(Q).declareVariables(...ee,re)}
      ${q.mainStart()}
      ${q.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${Y}}`};return{name:"ConvTranspose2D",shaderCache:{hint:`${t.cacheKey};${c}${$}${y}${f}${_}`,inputDependencies:b},getRunData:()=>({dispatchGroup:{x:x[0],y:x[1],z:x[2]},outputs:[{dims:r?r(n):n,dataType:e[0].dataType}],programUniforms:v}),getShaderSource:D}}}),Ol,Rl,Bl,$n,Nl,Ml,vn,Dl,Pl,X_=U(()=>{Z_(),Rt(),ft(),Ol=(e,t,r,i,n,a)=>(e-1)*t+r+(i-1)*n+1-a,Rl=(e,t,r,i,n)=>{let a=Math.floor(e/2);t==="SAME_UPPER"?(r[i]=a,r[n]=e-a):t==="SAME_LOWER"&&(r[i]=e-a,r[n]=a)},Bl=(e,t,r,i,n,a,s,u,l,d)=>{let c=e.length-2,f=d.length===0;l.length<c&&l.push(...Array(c-l.length).fill(0));let g=e[0],_=t[u?3:1]*n;for(let y=0,$=e.length-c-(u?1:0);y<c;++y,++$){let S=e[$],x=f?S*s[y]:d[y],b=Ol(S,s[y],a[y],t[$],r[y],x);Rl(b,i,a,y,y+c),f&&d.push(s[y]*(S-1)+l[y]+(t[$]-1)*r[y]+1-a[y]-a[y+c])}d.splice(0,0,g),d.splice(u?3:1,0,_)},$n=(e,t)=>{let r=e.kernelShape.slice();if(e.kernelShape.length===0||e.kernelShape.reduce((f,g)=>f*g,1)===0){r.length=0;for(let f=2;f<t[1].dims.length;++f)r.push(t[1].dims[f])}let i=e.format==="NHWC";r.splice(0,0,t[1].dims[0]),r.splice(i?3:1,0,t[1].dims[1]);let n=e.pads.slice(),a=e.outputShape.slice(),s=e.outputPadding.slice(),u=t[0].dims,l=e.dilations.slice();if(l.reduce((f,g)=>f+g,0)===0){let f=t[0].dims.length-2;l=new Array(f).fill(1)}let d=e.strides.slice();if(d.reduce((f,g)=>f+g,0)===0){let f=t[0].dims.length-2;d=new Array(f).fill(1)}Bl(u,r,l,e.autoPad,e.group,n,d,i,s,a);let c=Object.assign({},e);return Object.assign(c,{kernelShape:r,pads:n,outputPadding:s,outputShape:a,dilations:l,strides:d}),c},Nl=e=>{let t=un(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][typeof e.autoPad>"u"?0:e.autoPad],n=e.dilations,a=e.group??1,s=e.kernelShape,u=e.pads,l=e.strides,d=e.wIsConst(),c=e.outputPadding,f=e.outputShape;return{autoPad:i,format:r,dilations:n,group:a,kernelShape:s,outputPadding:c,outputShape:f,pads:u,strides:l,wIsConst:d,...t,cacheKey:`${e.format};${t.activation};`}},Ml=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length!==4&&e[0].dims.length!==3)throw new Error("currently only support 2-dimensional conv");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[0];if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");let n=e[1].dims[1]*t.group;if(e.length===3&&(e[2].dims.length!==1||e[2].dims[0]!==n))throw new Error("invalid bias");let a=e[0].dims.length-2;if(t.dilations.reduce((s,u)=>s+u,0)>0&&t.dilations.length!==a)throw new Error(`dilations should be ${a}D`);if(t.strides.reduce((s,u)=>s+u,0)>0&&t.strides.length!==a)throw new Error(`strides should be ${a}D`);if(t.pads.reduce((s,u)=>s+u,0)>0&&t.pads.length!==a*2)throw new Error(`pads should be ${a*2}D`);if(t.outputPadding.length!==a&&t.outputPadding.length!==0)throw new Error(`output_padding should be ${a}D`);if(t.kernelShape.reduce((s,u)=>s+u,0)>0&&t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape");if(t.outputShape.length!==0&&t.outputShape.length!==e[0].dims.length-2)throw new Error("invalid output shape")},vn=(e,t,r,i)=>{let n=e.kernelCustomData.wT??e.compute(Pe(t[1],[2,3,0,1]),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=n);let a=[t[0],n];t.length===3&&a.push(t[2]),e.compute(Al(a,r,i),{inputs:a})},Dl=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let n=t.kernelShape;(n.length===0||n[0]===0)&&(n=[e.inputs[1].dims[2]]);let a=t.dilations;(a.length===0||a[0]===0)&&(a=[1]);let s=t.strides;(s.length===0||s[0]===0)&&(s=[1]);let u=t.pads;u.length===0&&(u=[0,0]),u=[0,u[0],0,u[1]],s=[1].concat(s),a=[1].concat(a),n=[1].concat(n);let l=t.outputPadding;l=[0].concat(l);let d=$n({...t,pads:u,strides:s,dilations:a,kernelShape:n,outputPadding:l},i);vn(e,i,d,c=>r?[c[0],c[2],c[3]]:[c[0],c[1],c[3]])},Pl=(e,t)=>{if(Ml(e.inputs,t),e.inputs[0].dims.length===3)Dl(e,t);else{let r=$n(t,e.inputs);vn(e,e.inputs,r)}}}),Ul,ql,Ll,Q_=U(()=>{te(),ie(),ke(),ne(),Ul=(e,t,r,i)=>{let n=O.size(t),a=t.length,s=N("input",e,a),u=F("output",e,a),l=r.dataType===6?r.getInt32Array()[0]:Number(r.getBigInt64Array()[0]),d=O.normalizeAxis(l,a),c=f=>{let g=` i32(${s.indicesGet("inputIndices","uniforms.axis")}) `,_=j("uniforms.input_shape","uniforms.axis",a),y=i.reverse?g+(i.exclusive?" + 1":""):"0",$=i.reverse?_:g+(i.exclusive?"":" + 1");return`
                ${f.registerUniform("outputSize","u32").registerUniform("axis","u32").declareVariables(s,u)}
                ${f.mainStart()}
                  ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${u.offsetToIndices("global_idx")};
                  var sum = ${u.type.value}(0);
                  let first : i32 = ${y};
                  let last : i32 = ${$};
                  for (var i : i32 = first; i < last; i++) {
                    ${s.indicesSet("inputIndices","uniforms.axis","u32(i)")};
                    sum = sum + ${s.getByIndices("inputIndices")};
                  }
                  ${u.setByOffset("global_idx","sum")};
                }`};return{name:"CumSum",shaderCache:{hint:i.cacheKey,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:t,dataType:e}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:[{type:12,data:n},{type:12,data:d},...K(t,t)]}),getShaderSource:c}},ql=(e,t)=>{let r=e.inputs[0].dims,i=e.inputs[0].dataType,n=e.inputs[1];e.compute(Ul(i,r,n,t),{inputs:[0]})},Ll=e=>{let t=e.exclusive===1,r=e.reverse===1;return he({exclusive:t,reverse:r})}}),Wl,Vl,Gl,Fl,Hl,Y_=U(()=>{te(),ie(),ke(),ne(),Wl=e=>{if(!e||e.length!==1)throw new Error("DepthToSpace requires 1 input.");if(e[0].dims.length!==4)throw new Error("DepthToSpace requires 4D input.")},Vl=(e,t,r,i)=>{let n=[];n.push(`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`);for(let a=0;a<t;++a)n.push(r.indicesSet("a",e[a],`i[${a}]`));return n.push("return a;}"),n.join(`
`)},Gl=(e,t)=>{let r,i,n,a,s,u,l=t.format==="NHWC",d=t.blocksize,c=t.mode==="DCR";l?([r,i,n,a]=e.dims,s=c?[r,i,n,d,d,a/d**2]:[r,i,n,a/d**2,d,d],u=c?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([r,i,n,a]=[e.dims[0],e.dims[2],e.dims[3],e.dims[1]],s=c?[r,d,d,a/d**2,i,n]:[r,a/d**2,d,d,i,n],u=c?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let f=e.reshape(s),g=f.dims.length,_=e.dataType,y=N("a",_,g),$=F("output",_,g),S=x=>`
  ${x.registerUniform("output_size","u32").declareVariables(y,$)}

  ${Vl(u,g,y,$)}

  ${x.mainStart()}
    ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${$.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${$.setByOffset("global_idx",y.getByIndices("aIndices"))}
  }`;return{name:"DepthToSpace",shaderCache:{hint:`${e.dims};${t.blocksize};${t.mode}`,inputDependencies:["rank"]},getRunData:x=>{let b=l?[r,i*d,n*d,a/d**2]:[r,a/d**2,i*d,n*d],z=O.size(b),k=f.dims,E=O.sortBasedOnPerm(k,u);return{outputs:[{dims:b,dataType:x[0].dataType}],dispatchGroup:{x:Math.ceil(z/64)},programUniforms:[{type:12,data:z},...K(k,E)]}},getShaderSource:S}},Fl=(e,t)=>{Wl(e.inputs),e.compute(Gl(e.inputs[0],t))},Hl=e=>he({blocksize:e.blocksize,mode:e.mode,format:e.format})}),Vr,dr,xn,jl,Kl,Zl,Xl,kn,Ql,Yl,Jl,J_=U(()=>{te(),ie(),ke(),ne(),Vr="[a-zA-Z]|\\.\\.\\.",dr="("+Vr+")+",xn="^"+dr+"$",jl="("+dr+",)*"+dr,Kl="^"+jl+"$",Zl=class{constructor(e=-1){this.symbolToIndices=new Map,this.inputIndex=e}addSymbol(e,t){let r=this.symbolToIndices.get(e);r===void 0?r=[t]:r.push(t),this.symbolToIndices.set(e,r)}},Xl=class{constructor(e,t){this.equation=t,this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=new Array,this.outputDims=[];let[r,i]=t.includes("->")?t.split("->",2):[t,""];if(!r.match(RegExp(Kl)))throw new Error("Invalid LHS term");if(r.split(",").forEach((n,a)=>{let s=e[a].dims.slice();if(!n.match(RegExp(xn)))throw new Error("Invalid LHS term");let u=this.processTerm(n,!0,s,a);this.lhs.push(u)}),i==="")i+=[...this.symbolToInfo.entries()].filter(([n,a])=>a.count===1||n==="...").map(([n])=>n).join("");else if(!i.match(RegExp(dr)))throw new Error("Invalid RHS");i.match(RegExp(Vr,"g"))?.forEach(n=>{if(n==="...")this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let a=this.symbolToInfo.get(n);if(a===void 0)throw new Error("Invalid RHS symbol");this.outputDims.push(a.dimValue)}}),this.rhs=this.processTerm(i,!1,this.outputDims)}addSymbol(e,t,r){let i=this.symbolToInfo.get(e);if(i!==void 0){if(i.dimValue!==t&&i.count!==1)throw new Error("Dimension mismatch");i.count++,i.inputIndices.push(r)}else i={count:1,dimValue:t,inputIndices:[r]};this.symbolToInfo.set(e,i)}processTerm(e,t,r,i=-1){let n=r.length,a=!1,s=[],u=0;if(!e.match(RegExp(xn))&&!t&&e!=="")throw new Error("Invalid LHS term");let l=e.match(RegExp(Vr,"g")),d=new Zl(i);return l?.forEach((c,f)=>{if(c==="..."){if(a)throw new Error("Only one ellipsis is allowed per input term");a=!0;let g=n-l.length+1;if(g<0)throw new Error("Ellipsis out of bounds");if(s=r.slice(u,u+g),this.hasEllipsis){if(this.ellipsisDims.length!==s.length||this.ellipsisDims.toString()!==s.toString())throw new Error("Ellipsis dimensions mismatch")}else if(t)this.hasEllipsis=!0,this.ellipsisDims=s;else throw new Error("Ellipsis must be specified in the LHS");for(let _=0;_<s.length;_++){let y=String.fromCharCode(48+_);d.addSymbol(y,f+_),this.addSymbol(y,r[u++],i)}}else d.addSymbol(c,f+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(c,r[u++],i)}),d}},kn=e=>e+"_max",Ql=(e,t,r,i)=>{let n=e.map(d=>d.length).map((d,c)=>N(`input${c}`,t,d)),a=O.size(i),s=F("output",t,i.length),u=[...r.symbolToInfo.keys()].filter(d=>!r.rhs.symbolToIndices.has(d)),l=d=>{let c=[],f="var prod = 1.0;",g="var sum = 0.0;",_="sum += prod;",y=[],$=[],S=[],x=[],b=r.symbolToInfo.size===r.rhs.symbolToIndices.size;r.symbolToInfo.forEach((k,E)=>{if(r.rhs.symbolToIndices.has(E)){let A=r.rhs.symbolToIndices.get(E)?.[0];A!==void 0&&r.lhs.forEach((C,v)=>{if(k.inputIndices.includes(v)){let D=C.symbolToIndices.get(E);if(D===void 0)throw new Error("Invalid symbol error");D.forEach(q=>{c.push(`${n[v].indicesSet(`input${v}Indices`,q,s.indicesGet("outputIndices",A))}`)})}})}else r.lhs.forEach((A,C)=>{if(k.inputIndices.includes(C)){let v=A.symbolToIndices.get(E);if(v===void 0)throw new Error("Invalid symbol error");v.forEach(D=>{y.push(`${n[C].indicesSet(`input${C}Indices`,D,`${E}`)}`)}),x.push(`prod *= ${n[C].getByIndices(`input${C}Indices`)};`)}}),$.push(`for(var ${E}: u32 = 0; ${E} < uniforms.${kn(E)}; ${E}++) {`),S.push("}")});let z=b?[...c,`let sum = ${n.map((k,E)=>k.getByIndices(`input${E}Indices`)).join(" * ")};`]:[...c,g,...$,...y,f,...x,_,...S];return`
            ${d.registerUniforms(u.map(k=>({name:`${kn(k)}`,type:"u32"}))).registerUniform("outputSize","u32").declareVariables(...n,s)}

            ${d.mainStart()}
            ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${s.offsetToIndices("global_idx")};
            ${n.map((k,E)=>`var input${E}Indices: ${n[E].type.indices};`).join(`
`)}
            ${z.join(`
`)};
            ${s.setByOffset("global_idx","sum")};
          }`};return{name:"Einsum",shaderCache:{hint:r.equation,inputDependencies:e.map(()=>"rank")},getRunData:()=>{let d=u.filter(f=>r.symbolToInfo.has(f)).map(f=>({type:12,data:r.symbolToInfo.get(f)?.dimValue||0}));d.push({type:12,data:a});let c=e.map((f,g)=>[...K(f)]).reduce((f,g)=>f.concat(g),d);return c.push(...K(i)),{outputs:[{dims:i,dataType:t}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:c}},getShaderSource:l}},Yl=(e,t)=>{let r=new Xl(e.inputs,t.equation),i=r.outputDims,n=e.inputs.map((a,s)=>a.dims);e.compute(Ql(n,e.inputs[0].dataType,r,i))},Jl=e=>{let t=e.equation.replace(/\s+/g,"");return he({equation:t})}}),ed,Sn,td,rd,id,e0=U(()=>{te(),ie(),ne(),ed=e=>{if(!e||e.length!==2)throw new Error("Expand requires 2 input.");let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=r.length<t.length?0:r.length-t.length,n=t.length<r.length?0:t.length-r.length;for(;i<r.length&&n<t.length;++i,++n)if(r[i]!==t[n]&&r[i]!==1&&t[n]!==1)throw new Error("Expand requires shape to be broadcastable to input")},Sn=(e,t)=>{let r=e.length-t.length,i=[];for(let n=0;n<r;++n)i.push(e[n]);for(let n=0;n<t.length;++n)i.push(t[n]===1?e[n+r]:t[n]);return i},td=(e,t)=>e.length>t.length?Sn(e,t):Sn(t,e),rd=e=>{let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=td(t,r),n=e[0].dataType,a=n===9||O.size(t)===1,s=n===9||t.length>0&&t[t.length-1]%4===0?4:1,u=a||i.length>0&&i[i.length-1]%4===0?4:1,l=Math.ceil(O.size(i)/u),d=f=>{let g=N("input",n,t.length,s),_=F("output",n,i.length,u),y;if(n===9){let $=(S,x,b="")=>`
          let outputIndices${x} = ${_.offsetToIndices(`outputOffset + ${x}u`)};
          let offset${x} = ${g.broadcastedIndicesToOffset(`outputIndices${x}`,_)};
          let index${x} = offset${x} / 4u;
          let component${x} = offset${x} % 4u;
          ${S}[${x}] = ${b}(${g.getByOffset(`index${x}`)}[component${x}]);
        `;y=`
        let outputOffset = global_idx * ${u};
        var data = vec4<u32>(0);
        ${$("data",0,"u32")}
        ${$("data",1,"u32")}
        ${$("data",2,"u32")}
        ${$("data",3,"u32")}
        ${_.setByOffset("global_idx","data")}
      }`}else y=`
        let outputIndices = ${_.offsetToIndices(`global_idx * ${u}`)};
        let inputOffset = ${g.broadcastedIndicesToOffset("outputIndices",_)};
        let data = ${_.type.value}(${g.getByOffset(`inputOffset / ${s}`)});
        ${_.setByOffset("global_idx","data")}
      }`;return`
    ${f.registerUniform("vec_size","u32").declareVariables(g,_)}
    ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${y}`},c=[{type:12,data:l},...K(t,i)];return{name:"Expand",shaderCache:{hint:`${i.length};${s}${u}`,inputDependencies:["rank"]},getShaderSource:d,getRunData:()=>({outputs:[{dims:i,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:c})}},id=e=>{ed(e.inputs),e.compute(rd(e.inputs),{inputs:[0]})}}),nd,ad,t0=U(()=>{te(),ie(),ne(),on(),nd=e=>{let t=e[0].dataType,r=O.size(e[0].dims),i=O.size(e[1].dims),n=i%4===0,a=s=>{let u=N("x",t,[1],4),l=N("bias",t,[1],4),d=F("y",t,[1],4),c=[{name:"output_vec_size",type:"u32"},{name:"bias_size",type:"u32"}],f=_=>`
      let bias${_}_offset: u32 = (global_idx * 4 + ${_}) % uniforms.bias_size;
      let bias${_} = ${l.getByOffset(`bias${_}_offset / 4`)}[bias${_}_offset % 4];`,g=n?`
      let bias = ${l.getByOffset("global_idx % (uniforms.bias_size / 4)")};`:`${f(0)}${f(1)}${f(2)}${f(3)}
      let bias = ${u.type.value}(bias0, bias1, bias2, bias3);`;return`${s.registerUniforms(c).declareVariables(u,l,d)}

    ${an(Oe(t))}

    ${s.mainStart(Ft)}
      ${s.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${u.getByOffset("global_idx")};
      ${g}
      let x_in = x + bias;
      ${d.setByOffset("global_idx",sn("x_in"))}
    }`};return{name:"FastGeluWithBias",shaderCache:{hint:`${n}`,inputDependencies:["type","type"]},getShaderSource:a,getRunData:s=>({outputs:[{dims:s[0].dims,dataType:s[0].dataType}],programUniforms:[{type:12,data:Math.ceil(r/4)},{type:12,data:i}],dispatchGroup:{x:Math.ceil(r/Ft/4)}})}},ad=e=>{e.inputs.length<2||O.size(e.inputs[1].dims)===0?Uu(e):e.compute(nd(e.inputs))}}),sd,od,ud,ld,r0=U(()=>{te(),ie(),ke(),ne(),sd=e=>{if(!e||e.length!==2)throw new Error("Gather requires 2 inputs.")},od=(e,t)=>{let r=e[0].dims,i=e[1].dims,n=r.length,a=O.normalizeAxis(t.axis,n),s=r.slice(0);s.splice(a,1,...i);let u=r[a],l=e[0].dataType===9?4:1,d=Math.ceil(O.size(s)/l),c=[{type:12,data:d},{type:6,data:u},{type:12,data:a},...K(e[0].dims,e[1].dims,s)],f=g=>{let _=N("data",e[0].dataType,e[0].dims.length,l),y=N("inputIndices",e[1].dataType,e[1].dims.length),$=F("output",e[0].dataType,s.length,l),S=b=>{let z=i.length,k=`var indicesIndices${b}  = ${y.type.indices}(0);`;for(let E=0;E<z;E++)k+=`${z>1?`indicesIndices${b}[${E}]`:`indicesIndices${b}`} = ${s.length>1?`outputIndices${b}[uniforms.axis + ${E}]`:`outputIndices${b}`};`;k+=`
          var idx${b} = ${y.getByIndices(`indicesIndices${b}`)};
          if (idx${b} < 0) {
            idx${b} = idx${b} + uniforms.axisDimLimit;
          }
          var dataIndices${b} : ${_.type.indices};
        `;for(let E=0,A=0;E<n;E++)E===a?(k+=`${n>1?`dataIndices${b}[${E}]`:`dataIndices${b}`} = u32(idx${b});`,A+=z):(k+=`${n>1?`dataIndices${b}[${E}]`:`dataIndices${b}`} = ${s.length>1?`outputIndices${b}[${A}]`:`outputIndices${b}`};`,A++);return k},x;if(e[0].dataType===9){let b=(z,k,E="")=>`
          let outputIndices${k} = ${$.offsetToIndices(`outputOffset + ${k}u`)};
          ${S(k)};
          let offset${k} = ${_.indicesToOffset(`dataIndices${k}`)};
          let index${k} = offset${k} / 4u;
          let component${k} = offset${k} % 4u;
          ${z}[${k}] = ${E}(${_.getByOffset(`index${k}`)}[component${k}]);
        `;x=`
        let outputOffset = global_idx * ${l};
        var value = vec4<u32>(0);
        ${b("value",0,"u32")}
        ${b("value",1,"u32")}
        ${b("value",2,"u32")}
        ${b("value",3,"u32")}
        ${$.setByOffset("global_idx","value")}
      `}else x=`
      let outputIndices = ${$.offsetToIndices("global_idx")};
      ${S("")};
      let value = ${_.getByIndices("dataIndices")};
      ${$.setByOffset("global_idx","value")};
      `;return`
      ${g.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(_,y,$)}
      ${g.mainStart()}
        ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${x}
      }`};return{name:"Gather",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:s,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:c}),getShaderSource:f}},ud=e=>he({axis:e.axis}),ld=(e,t)=>{let r=e.inputs;sd(r),e.compute(od(e.inputs,t))}}),dd,pd,cd,i0=U(()=>{te(),ie(),ne(),dd=(e,t,r,i,n,a,s,u,l)=>{let d=[{type:12,data:a},{type:12,data:i},{type:12,data:n},{type:12,data:r},{type:12,data:s},{type:12,data:u},{type:12,data:l}],c=[a];d.push(...K(t.dims,c));let f=g=>{let _=N("indices_data",t.dataType,t.dims.length),y=F("input_slice_offsets_data",12,1,1),$=[_,y],S=[{name:"output_size",type:"u32"},{name:"batch_dims",type:"u32"},{name:"input_dims",type:"u32",length:n.length},{name:"sizes_from_slice_dims_data",type:"u32",length:r.length},{name:"num_slices_per_batch",type:"u32"},{name:"input_batch_stride",type:"u32"},{name:"num_slice_dims",type:"u32"}];return`
  ${g.registerUniforms(S).declareVariables(...$)}
  ${g.mainStart()}
    ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${n.length===1?"index += i32(uniforms.input_dims);":"index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${r.length===1?"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);":"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`};return e.compute({name:"computeSliceOffsets",shaderCache:{hint:`${n.length}_${r.length}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:c,dataType:e.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:d}),getShaderSource:f},{inputs:[t],outputs:[-1]})[0]},pd=(e,t)=>{let r=e.inputs,i=r[0].dims,n=r[0].dataType,a=r[1].dims,s=a[a.length-1],u=O.sizeToDimension(a,a.length-1),l=O.sizeFromDimension(i,t.batchDims+s),d=O.sizeToDimension(i,t.batchDims),c=O.sizeFromDimension(i,t.batchDims),f=u/d,g=new Array(s),_=l;for(let k=0;k<s;++k)g[s-1-k]=_,_*=i[t.batchDims+s-1-k];let y=dd(e,r[1],g,t.batchDims,i,u,f,c,s),$=t.batchDims+s;if($>i.length)throw new Error("last dimension of indices must not be larger than rank of input tensor");let S=a.slice(0,-1).concat(i.slice($)),x=O.size(S),b=[{type:12,data:x},{type:12,data:l},...K(r[0].dims,y.dims,S)],z=k=>{let E=N("data",r[0].dataType,r[0].dims.length),A=N("slice_offsets",12,y.dims.length),C=F("output",r[0].dataType,S.length);return`
          ${k.registerUniform("output_size","u32").registerUniform("slice_size","u32").declareVariables(E,A,C)}
            ${k.mainStart()}
            ${k.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`};e.compute({name:"GatherND",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:S,dataType:n}],dispatchGroup:{x:Math.ceil(x/64)},programUniforms:b}),getShaderSource:z},{inputs:[r[0],y]})},cd=e=>({batchDims:e.batch_dims,cacheKey:""})}),hd,fd,md,gd,n0=U(()=>{te(),ie(),ke(),ne(),hd=(e,t)=>{if(e.length<3||e.length>4)throw new Error("GatherBlockQuantized requires 3 or 4 inputs.");let r=O.normalizeAxis(t.quantizeAxis,e[0].dims.length),i=t.blockSize,n=e[0],a=e[2],s=e.length===4?e[3]:void 0;if(a.dims.length!==n.dims.length||!n.dims.map((u,l)=>l===r?Math.ceil(u/i)===a.dims[l]:u===a.dims[l]).reduce((u,l)=>u&&l,!0))throw new Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");if(s){if(s.dataType!==n.dataType)throw new Error("Zero point must have the same data type as the input tensor.");if(s.dims.length!==a.dims.length||!s.dims.map((u,l)=>u===a.dims[l]).reduce((u,l)=>u&&l,!0))throw new Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.")}},fd=(e,t)=>{let r=e[0].dims,i=e[1].dims,n=r.length,a=O.normalizeAxis(t.gatherAxis,n),s=O.normalizeAxis(t.quantizeAxis,n),u=r.slice(0);u.splice(a,1,...i);let l=O.size(u),d=e[2].dataType,c=e[0].dataType===22,f=[{type:12,data:l},{type:12,data:s},{type:12,data:a},{type:12,data:t.blockSize},...K(...e.map((_,y)=>_.dims),u)],g=_=>{let y=N("data",e[0].dataType,e[0].dims.length),$=N("inputIndices",e[1].dataType,e[1].dims.length),S=N("scales",e[2].dataType,e[2].dims.length),x=e.length>3?N("zeroPoint",e[3].dataType,e[3].dims.length):void 0,b=F("output",d,u.length),z=[y,$,S];x&&z.push(x);let k=[{name:"output_size",type:"u32"},{name:"quantize_axis",type:"u32"},{name:"gather_axis",type:"u32"},{name:"block_size",type:"u32"}];return`
        ${_.registerUniforms(k).declareVariables(...z,b)}
        ${_.mainStart()}
        let output_indices = ${b.offsetToIndices("global_idx")};
        var indices_indices = ${$.type.indices}(0);
        ${i.length>1?`
          for (var i: u32 = 0; i < ${i.length}; i++) {
            let index = ${b.indicesGet("output_indices","uniforms.gather_axis + i")};
            ${$.indicesSet("indices_indices","i","index")};
          }`:`indices_indices = ${b.indicesGet("output_indices","uniforms.gather_axis")};`};
        var data_indices = ${y.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${b.indicesGet("output_indices","i")};
          ${y.indicesSet("data_indices","i","index")};
        }
        var index_from_indices = ${$.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${r[a]};
        }
        ${y.indicesSet("data_indices","uniforms.gather_axis","u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${u.length}; i++) {
          let index = ${b.indicesGet("output_indices",`i + ${i.length} - 1`)};
          ${y.indicesSet("data_indices","i","index")};
        }
        let data_offset = ${y.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${y.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${c?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${S.indicesGet("data_indices","uniforms.quantize_axis")} / uniforms.block_size;
        ${S.indicesSet("scale_indices","uniforms.quantize_axis","quantize_axis_index")};
        var scale = ${S.getByIndices("scale_indices")};
        ${x?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${x.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${x.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${c?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:"var zero_point = 0"};
        let dequantized_data = ${Oe(d)}(quantized_data - zero_point) * scale;
        ${b.setByOffset("global_idx","dequantized_data")};
    }`};return{name:"GatherBlockQuantized",shaderCache:{hint:`${t.cacheKey};${e.filter((_,y)=>y!==1).map(_=>_.dims.join("_")).join(";")}`,inputDependencies:Array.from({length:e.length},(_,y)=>"rank")},getRunData:()=>({outputs:[{dims:u,dataType:d}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:f}),getShaderSource:g}},md=(e,t)=>{let r=e.inputs;hd(r,t),e.compute(fd(e.inputs,t))},gd=e=>he({blockSize:e.blockSize,gatherAxis:e.gatherAxis,quantizeAxis:e.quantizeAxis})}),_d,yd,bd,wd,a0=U(()=>{te(),ie(),ke(),ne(),_d=e=>{if(!e||e.length!==2)throw new Error("GatherElements requires 2 inputs.");if(e[0].dims.length<1)throw new Error("GatherElements requires that the data input be rank >= 1.");if(e[0].dims.length!==e[1].dims.length)throw new Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},yd=(e,t)=>{let r=e[0].dims,i=e[0].dataType,n=r.length,a=e[1].dims,s=e[1].dataType,u=O.normalizeAxis(t.axis,n),l=r[u],d=a.slice(0),c=O.size(d),f=N("input",i,n),g=N("indicesInput",s,a.length),_=F("output",i,d.length),y=[{type:12,data:c},{type:6,data:l},{type:12,data:u}];return y.push(...K(r,a,d)),{name:"GatherElements",shaderCache:{inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:d,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(c/64)},programUniforms:y}),getShaderSource:$=>`
      ${$.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(f,g,_)}
      ${$.mainStart()}
      ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${_.offsetToIndices("global_idx")};

      var idx = ${g.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${f.type.indices}(outputIndices);
      ${f.indicesSet("inputIndices","uniforms.axis","u32(idx)")};
      let value = ${f.getByIndices("inputIndices")};

      ${_.setByOffset("global_idx","value")};
  }`}},bd=e=>he({axis:e.axis}),wd=(e,t)=>{let r=e.inputs;_d(r),e.compute(yd(e.inputs,t))}}),$d,vd,xd,kd,s0=U(()=>{te(),ie(),ne(),$d=e=>{if(!e)throw new Error("Input is missing");if(e.length<2||e.length>3)throw new Error("Invaid input number.");if(e.length===3&&e[2].dims.length>2)throw new Error("Invalid input shape of C");if(e[0].dataType!==e[1].dataType||e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("Input types are mismatched")},vd=(e,t)=>{let r=e[0].dims.slice(),i=e[1].dims.slice(),[n,a,s]=Os.getShapeOfGemmResult(r,t.transA,i,t.transB,e.length===3?e[2].dims:void 0),u=[n,a];if(!u)throw new Error("Can't use gemm on the given tensors");let l=16,d=Math.ceil(a/l),c=Math.ceil(n/l),f=!0,g=O.size(u),_=[{type:12,data:f?d:g},{type:12,data:n},{type:12,data:a},{type:12,data:s},{type:1,data:t.alpha},{type:1,data:t.beta}],y=["type","type"];e.length===3&&(_.push(...K(e[2].dims)),y.push("rank")),_.push(...K(u));let $=x=>{let b="";t.transA&&t.transB?b="value += a[k * uniforms.M + m] * b[n * uniforms.K + k];":t.transA&&!t.transB?b="value += a[k * uniforms.M + m] * b[k * uniforms.N + n];":!t.transA&&t.transB?b="value += a[m * uniforms.K + k] * b[n * uniforms.K + k];":!t.transA&&!t.transB&&(b="value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");let z=t.alpha===1?"":"value *= uniforms.alpha;",k=N("a",e[0].dataType,e[0].dims),E=N("b",e[1].dataType,e[1].dims),A=k.type.value,C=null,v=[k,E];e.length===3&&(C=N("c",e[2].dataType,e[2].dims.length),v.push(C));let D=F("output",e[0].dataType,u.length);v.push(D);let q=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}];return`
  ${x.registerUniforms(q).declareVariables(...v)}

  ${x.mainStart()}
    ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${A}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${b}
    }

    ${z}
    ${C!=null?`let cOffset = ${C.broadcastedIndicesToOffset("vec2(m, n)",D)}; value += ${A}(uniforms.beta) * ${C.getByOffset("cOffset")};`:""}
    output[global_idx] = value;
  }`},S=x=>{let b=N("a",e[0].dataType,e[0].dims),z=N("b",e[1].dataType,e[1].dims),k=null,E=[b,z];e.length===3&&(k=N("c",e[2].dataType,e[2].dims.length),E.push(k));let A=F("output",e[0].dataType,u.length);E.push(A);let C=[{name:"num_tile_n",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}],v="",D="";t.transA&&t.transB?(D=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${z.type.value}(0);
      }
      `,v="value += tile_a[k][local_id.y] * tile_b[local_id.x][k];"):t.transA&&!t.transB?(D=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${z.type.value}(0);
      }
      `,v="value += tile_a[k][local_id.y] * tile_b[k][local_id.x];"):!t.transA&&t.transB?(D=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${z.type.value}(0);
      }
      `,v="value += tile_a[local_id.y][k] * tile_b[local_id.x][k];"):!t.transA&&!t.transB&&(D=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${b.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${z.type.value}(0);
      }
      `,v="value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");let q=t.alpha===1?"":"value *= uniforms.alpha;";return`
  ${x.registerUniforms(C).declareVariables(...E)}
  var<workgroup> tile_a: array<array<${b.type.storage}, ${l}>, ${l}>;
  var<workgroup> tile_b: array<array<${z.type.storage}, ${l}>, ${l}>;
  ${x.mainStart([l,l,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${l};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${l};
    let num_tiles = (uniforms.K - 1) / ${l} + 1;
    var k_start = 0u;
    var value = ${A.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${D}
      k_start = k_start + ${l};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${l}; k++) {
        ${v}
      }
      workgroupBarrier();
    }

    ${q}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${k!=null?`let cOffset = ${k.broadcastedIndicesToOffset("vec2(m, n)",A)}; value += ${A.type.value}(uniforms.beta) * ${k.getByOffset("cOffset")};`:""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`};return f?{name:"GemmShared",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:u,dataType:e[0].dataType}],dispatchGroup:{x:d*c},programUniforms:_}),getShaderSource:S}:{name:"Gemm",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:u,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:_}),getShaderSource:$}},xd=e=>{let t=e.transA,r=e.transB,i=e.alpha,n=e.beta;return{transA:t,transB:r,alpha:i,beta:n,cacheKey:`${e.transA};${e.transB};${e.alpha===1}`}},kd=(e,t)=>{$d(e.inputs),e.compute(vd(e.inputs,t))}}),et,ut,Bt,Nt,Sd,Td,zd,Ed,Id,Cd,Ad,Od,Rd,Bd,o0=U(()=>{te(),ie(),ke(),ne(),[et,ut,Bt,Nt]=[0,1,2,3],Sd=e=>{if(e[0].dims.length!==4)throw new Error("only 4-D tensor is supported.");if(e[0].dims.length!==e[1].dims.length)throw new Error("input dimensions must be equal to grid dimensions");if(e[0].dims.length-2!==e[1].dims[e[1].dims.length-1])throw new Error(`last dimension of grid must be equal to ${e[0].dims.length-2}`);if(e[0].dims[0]!==e[1].dims[0])throw new Error("grid batch size must match input batch size")},Td=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,zd=e=>`
  fn gs_bicubic_interpolate(p: mat4x4<${e}>, x: f32, y: f32) -> ${e} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${e}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,Ed=e=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${e.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,Id=e=>`
  ${e.paddingMode==="reflection"?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:""}
`,Cd=(e,t,r)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${t} {
     var pixel = ${t}(0);
     var indices = vec4<u32>(0);
     indices[${et}] = batch;
     indices[${ut}] = channel;`+(()=>{switch(r.paddingMode){case"zeros":return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${Bt}] = u32(r);
            indices[${Nt}] = u32(c);
          } else {
            return ${t}(0);
          }
        `;case"border":return`
          indices[${Bt}] = u32(clamp(r, 0, H - 1));
          indices[${Nt}] = u32(clamp(c, 0, W - 1));
        `;case"reflection":return`
          indices[${Bt}] = gs_reflect(r, border[1], border[3]);
          indices[${Nt}] = gs_reflect(c, border[0], border[2]);
        `;default:throw new Error(`padding mode ${r.paddingMode} is not supported`)}})()+`
    return ${e.getByIndices("indices")};
  }
`,Ad=(e,t,r)=>(()=>{switch(r.mode){case"nearest":return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${et}], indices[${ut}], border);
        `;case"bilinear":return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${et}], indices[${ut}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${et}], indices[${ut}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${et}], indices[${ut}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${et}], indices[${ut}], border);

          let dx2 = ${t}(f32(x2) - x);
          let dx1 = ${t}(x - f32(x1));
          let dy2 = ${t}(f32(y2) - y);
          let dy1 = ${t}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case"bicubic":return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${t}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${et}], indices[${ut}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw new Error(`mode ${r.mode} is not supported`)}})()+`${e.setByOffset("global_idx","result")}`,Od=(e,t)=>{let r=N("x",e[0].dataType,e[0].dims.length),i=[e[1].dims[0],e[1].dims[1],e[1].dims[2]],n=N("grid",e[1].dataType,i.length,2),a=[e[0].dims[0],e[0].dims[1],e[1].dims[1],e[1].dims[2]];t.format==="NHWC"&&(a=[e[0].dims[0],e[1].dims[1],e[1].dims[2],e[0].dims[3]],[et,ut,Bt,Nt]=[0,3,1,2]);let s=F("output",e[0].dataType,a.length),u=r.type.value,l=O.size(a),d=[{type:12,data:l},...K(e[0].dims,i,a)],c=f=>`
  ${f.registerUniform("output_size","u32").declareVariables(r,n,s)}
  ${Td}
  ${zd(u)}
  ${Ed(t)}
  ${Id(t)}
  ${Cd(r,u,t)}

  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${Bt}]);
      let W_in = i32(uniforms.x_shape[${Nt}]);

      ${t.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${s.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${et}], indices[${Bt}], indices[${Nt}]);
      let nxy = ${n.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${Ad(s,u,t)}
  }`;return{name:"GridSample",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:["type","type"]},getRunData:f=>{let g=O.size(a);return{outputs:[{dims:a,dataType:f[0].dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:d}},getShaderSource:c}},Rd=(e,t)=>{Sd(e.inputs),e.compute(Od(e.inputs,t))},Bd=e=>he({alignCorners:e.align_corners,mode:e.mode,paddingMode:e.padding_mode,format:e.format})}),Re,Nd,Md,Tn,Dd,pr,Pd,Ud=U(()=>{te(),ie(),ke(),Fi(),rn(),ne(),ft(),Re=(e,t)=>e.length>t&&e[t].dims.length>0?e[t]:void 0,Nd=(e,t)=>{let r=e[0],i=Re(e,1),n=Re(e,2),a=Re(e,3),s=Re(e,4),u=Re(e,5),l=Re(e,6),d=Re(e,7);if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let c=r.dims[0],f=r.dims[1],g=r.dims.length===3?r.dims[2]:t.numHeads*r.dims[4],_=f,y=0,$=0,S=Math.floor(g/t.numHeads);if(l&&d&&O.size(l.dims)&&O.size(d.dims)){if(l.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(l.dims[0]!==c||l.dims[1]!==t.numHeads||l.dims[3]!==S)throw new Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');if(d.dims[0]!==c||d.dims[1]!==t.numHeads||d.dims[3]!==S)throw new Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');if(l.dims[2]!==d.dims[2])throw new Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');if(d.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');y=l.dims[2],$=l.dims[2]}else if(l&&O.size(l.dims)||d&&O.size(d.dims))throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let x;if(i&&O.size(i.dims)>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(i.dims[2]!==r.dims[2])throw new Error('Input "query" and "key" shall have same dim 2 (hidden_size)');x=2,_=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==S)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(n)throw new Error('Expect "value" be none when "key" has packed kv format.');x=5,_=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==S)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');x=0,_=i.dims[2]}}else{if(r.dims.length!==5)throw new Error('Input "query" is expected to have 5 dimensions when key is empty');if(r.dims[2]!==t.numHeads||r.dims[3]!==3)throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');x=3}if(a&&O.size(a.dims)>0){if(a.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimension');if(i&&i.dims.length===5&&i.dims[3]===2)throw new Error("bias is not allowed for packed kv.")}let b=y+_,z=0;if(s&&O.size(s.dims)>0){z=8;let C=s.dims;throw C.length===1?C[0]===c?z=1:C[0]===3*c+2&&(z=3):C.length===2&&C[0]===c&&C[1]===b&&(z=5),z===8?new Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)'):new Error("Mask not supported")}let k=!1,E=g;if(n&&O.size(n.dims)>0){if(n.dims.length!==3&&n.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==n.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(n.dims.length===3){if(_!==n.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');E=n.dims[2]}else{if(_!==n.dims[2])throw new Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');E=n.dims[1]*n.dims[3],k=!0}}let A=!1;if(s&&O.size(s.dims)>0)throw new Error("Key padding mask is not supported");if(u&&O.size(u.dims)>0){if(u.dims.length!==4)throw new Error('Input "attention_bias" is expected to have 4 dimensions');if(u.dims[0]!==c||u.dims[1]!==t.numHeads||u.dims[2]!==f||u.dims[3]!==b)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:c,sequenceLength:f,pastSequenceLength:y,kvSequenceLength:_,totalSequenceLength:b,maxSequenceLength:$,inputHiddenSize:0,hiddenSize:g,vHiddenSize:E,headSize:S,vHeadSize:Math.floor(E/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:z,scale:t.scale,broadcastResPosBias:A,passPastInKv:k,qkvFormat:x}},Md=e=>he({...e}),Tn=he({perm:[0,2,1,3]}),Dd=(e,t,r,i,n,a,s)=>{let u=[i,n,a],l=O.size(u),d=[{type:12,data:l},{type:12,data:s},{type:12,data:a}],c=f=>{let g=F("qkv_with_bias",t.dataType,u),_=N("qkv",t.dataType,u),y=N("bias",r.dataType,u),$=[{name:"output_size",type:"u32"},{name:"bias_offset",type:"u32"},{name:"hidden_size",type:"u32"}];return`
  ${f.registerUniforms($).declareVariables(_,y,g)}
  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`};return e.compute({name:"MultiHeadAttentionAddBias",shaderCache:{inputDependencies:["type","type"]},getRunData:()=>({outputs:[{dims:u,dataType:t.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:d}),getShaderSource:c},{inputs:[t,r],outputs:[-1]})[0]},pr=(e,t,r,i,n,a,s,u)=>{let l=a;if(s&&O.size(s.dims)>0){if(i===1)throw new Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");return l=Dd(e,a,s,t,i,r*n,u),l=l.reshape([t,i,r,n]),r===1||i===1?l:e.compute(Pe(l,Tn.perm),{inputs:[l],outputs:[-1]})[0]}else return a.dims.length===3&&(l=a.reshape([t,i,r,n])),r===1||i===1?l:e.compute(Pe(l,Tn.perm),{inputs:[l],outputs:[-1]})[0]},Pd=(e,t)=>{let r=Nd(e.inputs,t),i=e.inputs[0],n=Re(e.inputs,1),a=Re(e.inputs,2),s=Re(e.inputs,3),u=Re(e.inputs,4),l=Re(e.inputs,5),d=Re(e.inputs,6),c=Re(e.inputs,7);if(i.dims.length===5)throw new Error("Packed QKV is not implemented");if(n?.dims.length===5)throw new Error("Packed KV is not implemented");let f=n&&a&&n.dims.length===4&&a.dims.length===4,g=pr(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,i,s,0);if(f)return sr(e,g,n,a,u,void 0,d,c,l,r);if(!n||!a)throw new Error("key and value must be provided");let _=pr(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.headSize,n,s,r.hiddenSize),y=pr(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.vHeadSize,a,s,2*r.hiddenSize);sr(e,g,_,y,u,void 0,d,c,l,r)}}),qd,Ld,Wd,Vd,zn,Gd,Fd,Hd=U(()=>{te(),ie(),ke(),ne(),qd=e=>{if(!e||e.length<1)throw new Error("too few inputs")},Ld=(e,t)=>{let r=[],i=t.numOutputs;return e[1].dims[0]>0&&(e[1].getBigInt64Array().forEach(n=>r.push(Number(n))),i=r.length),he({numOutputs:i,axis:t.axis,splitSizes:r})},Wd=e=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${e}u; i += 1u ) {
    if (index < ${j("uniforms.size_in_split_axis","i",e)}) {
        return i;
    }
    }
    return ${e}u;
}`,Vd=e=>{let t=e.length,r=[];for(let i=0;i<t;++i){let n=e[i].setByIndices("indices","input[global_idx]");t===1?r.push(n):i===0?r.push(`if (output_number == ${i}u) { ${n} }`):i===t-1?r.push(`else { ${n} }`):r.push(`else if (output_number == ${i}) { ${n} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${e[0].type.indices}, global_idx: u32) {
        ${r.join(`
`)}
      }`},zn=(e,t)=>{let r=e[0].dims,i=O.size(r),n=e[0].dataType,a=O.normalizeAxis(t.axis,r.length),s=new Array(t.numOutputs),u=N("input",n,r.length),l=new Array(t.numOutputs),d=[],c=[],f=0,g=[{type:12,data:i}];for(let y=0;y<t.numOutputs;y++){f+=t.splitSizes[y],l[y]=f;let $=r.slice();$[a]=t.splitSizes[y],c.push($),s[y]=F(`output${y}`,n,$.length),d.push({dims:c[y],dataType:e[0].dataType})}g.push({type:12,data:l},...K(r,...c));let _=y=>`
  ${y.registerUniform("input_size","u32").registerUniform("size_in_split_axis","u32",l.length).declareVariables(u,...s)}
  ${Wd(l.length)}
  ${Vd(s)}

  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${u.offsetToIndices("global_idx")};
    var index = ${u.indicesGet("indices",a)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${j("uniforms.size_in_split_axis","output_number - 1u",l.length)};
      ${u.indicesSet("indices",a,"index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;return{name:"Split",shaderCache:{hint:t.cacheKey,inputDependencies:["rank"]},getShaderSource:_,getRunData:()=>({outputs:d,dispatchGroup:{x:Math.ceil(i/64)},programUniforms:g})}},Gd=(e,t)=>{qd(e.inputs);let r=e.inputs.length===1?t:Ld(e.inputs,t);e.compute(zn(e.inputs,r),{inputs:[0]})},Fd=e=>{let t=e.axis,r=e.splitSizes,i=e.numOutputs<0?r.length:e.numOutputs;if(i!==r.length)throw new Error("numOutputs and splitSizes length must be equal");return he({axis:t,numOutputs:i,splitSizes:r})}}),jd,Gr,Kd,Zd=U(()=>{te(),ie(),ke(),ne(),jd=(e,t)=>{let[r,i,n,a]=e,{numHeads:s,rotaryEmbeddingDim:u}=t;if(r.dims.length!==3&&r.dims.length!==4)throw new Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${r.dims.length}`);if(!O.areEqual(i.dims,[])&&!O.areEqual(i.dims,[1])&&i.dims.length!==2)throw new Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${i.dims.length}`);if(n.dims.length!==2)throw new Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${n.dims.length}`);if(a.dims.length!==2)throw new Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${a.dims.length}`);if(!O.areEqual(n.dims,a.dims))throw new Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");if(u>0&&s===0)throw new Error("num_heads must be provided if rotary_embedding_dim is specified");let l=r.dims[0],d=r.dims[r.dims.length-2],c=n.dims[0],f=O.sizeFromDimension(r.dims,1)/d,g=u===0?n.dims[1]*2:f/s;if(u>g)throw new Error("rotary_embedding_dim must be less than or equal to head_size");if(i.dims.length===2){if(l!==i.dims[0])throw new Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${i.dims[0]}`);if(d!==i.dims[1])throw new Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${i.dims[1]}`)}if(d>c)throw new Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported");if(g/2!==n.dims[1]&&u/2!==n.dims[1])throw new Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${n.dims[1]}`)},Gr=(e,t)=>{let{interleaved:r,numHeads:i,rotaryEmbeddingDim:n,scale:a}=t,s=e[0].dims[0],u=O.sizeFromDimension(e[0].dims,1),l=e[0].dims[e[0].dims.length-2],d=u/l,c=e[2].dims[1],f=n===0?c*2:d/i,g=new Array(s,l,d/f,f-c),_=O.computeStrides(g),y=[{type:1,data:a},{type:12,data:g},{type:12,data:_},...e[0].dims.length===3?new Array({type:12,data:[u,d,f,1]}):[],...e[0].dims.length===4?new Array({type:12,data:[u,f,l*f,1]}):[],...K(e[0].dims,e[1].dims,e[2].dims,e[3].dims,e[0].dims)],$=S=>{let x=N("input",e[0].dataType,e[0].dims.length),b=N("position_ids",e[1].dataType,e[1].dims.length),z=N("cos_cache",e[2].dataType,e[2].dims.length),k=N("sin_cache",e[3].dataType,e[3].dims.length),E=F("output",e[0].dataType,e[0].dims.length);return S.registerUniforms([{name:"scale",type:"f32"},{name:"global_shape",type:"u32",length:g.length},{name:"global_strides",type:"u32",length:_.length},{name:"input_output_strides",type:"u32",length:_.length}]),`
        ${S.declareVariables(x,b,z,k,E)}

        ${S.mainStart(Ft)}
          let half_rotary_emb_dim = uniforms.${z.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${S.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${b.broadcastedIndicesToOffset("bsnh.xy",F("",b.type.tensor,2))};
            let position_id =
                u32(${b.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${r});
            let j = i + select(half_rotary_emb_dim, 1, ${r});
            let re = ${x.getByOffset("i")} * ${z.get("position_id","bsnh[3]")} -
                ${x.getByOffset("j")} * ${k.get("position_id","bsnh[3]")};
            ${E.setByOffset("i","re")}
            let im = ${x.getByOffset("i")} * ${k.get("position_id","bsnh[3]")} +
                ${x.getByOffset("j")} * ${z.get("position_id","bsnh[3]")};
            ${E.setByOffset("j","im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${E.setByOffset("k",x.getByOffset("k"))}
          }
        }`};return{name:"RotaryEmbedding",shaderCache:{hint:he({interleaved:r}).cacheKey,inputDependencies:["rank","rank","rank","rank"]},getShaderSource:$,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(O.size(g)/Ft)},programUniforms:y})}},Kd=(e,t)=>{jd(e.inputs,t),e.compute(Gr(e.inputs,t))}}),Xd,Qd,En,Yd,Jd,u0=U(()=>{ke(),te(),rn(),Ud(),Hd(),ft(),Zd(),ne(),Xd=(e,t)=>{if(t.doRotary&&e.length<=7)throw new Error("cos_cache and sin_cache inputs are required if do_rotary is specified");let r=e[0],i=e[1],n=e[2],a=e[3],s=e[4];if(t.doRotary!==0&&e.length<=7)throw new Error("cos_cast and sin_cache are expected if do_rotary attribute is non-zero");if(t.localWindowSize!==-1)throw new Error("Local attention is not supported");if(t.softcap!==0)throw new Error("Softcap is not supported");if(t.rotaryInterleaved!==0)throw new Error("Rotary interleaved is not supported");if(t.smoothSoftmax)throw new Error("Smooth softmax is not supported");if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let u=!1,l=r.dims[0],d=r.dims[1],c=r.dims.length===3?u?r.dims[2]/3:r.dims[2]:t.numHeads*r.dims[4],f=d,g=0,_=!i||i.dims.length===0,y=Math.floor(_?c/(t.numHeads+2*t.kvNumHeads):c/t.numHeads);_&&(c=y*t.numHeads);let $=a&&a.dims.length!==0,S=s&&s.dims.length!==0;if($&&a.dims.length===4&&a.dims[0]===l&&a.dims[1]!==t.kvNumHeads&&a.dims[2]===t.kvNumHeads&&a.dims[3]===y)throw new Error("BSNH pastKey/pastValue is not supported");if($&&S){if(a.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(s.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');g=a.dims[2]}else if($||S)throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let x=1;if(i&&i.dims.length>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(r.dims[2]%i.dims[2]!==0)throw new Error('Dimension 2 of "query" should be a multiple of "key"');f=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==y)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(n)throw new Error('Expect "value" be none when "key" has packed kv format.');f=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==y)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');f=i.dims[2]}}else{if(r.dims.length!==3&&r.dims.length!==5)throw new Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');if(r.dims.length===5&&(r.dims[2]!==t.numHeads||r.dims[3]!==3))throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');x=3}let b=0,z=!1,k=t.kvNumHeads?y*t.kvNumHeads:c;if(n&&n.dims.length>0){if(n.dims.length!==3&&n.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==n.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(n.dims.length===3){if(f!==n.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');k=n.dims[2]}else{if(f!==n.dims[2])throw new Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');k=n.dims[1]*n.dims[3],z=!0}}let E=e.length>4?e[5]:void 0;if(E){if(E.dims.length===0)throw new Error("seqlens_k must be at least 1D, got scalar.");let A=E.dims.reduce((C,v)=>C*v,1);if(A!==l)throw new Error(`seqlens_k must have batch_size (${l}) elements, got ${A}.`);for(let C=0;C<E.dims.length;C++)if(E.dims[C]!==1&&E.dims[C]!==l)throw new Error(`seqlens_k has unexpected shape. Each dimension must be 1 or batch_size (${l}), got dims[${C}] = ${E.dims[C]}.`)}return{batchSize:l,sequenceLength:d,pastSequenceLength:g,kvSequenceLength:f,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:c,vHiddenSize:k,headSize:y,vHeadSize:Math.floor(k/t.kvNumHeads),numHeads:t.numHeads,kvNumHeads:t.kvNumHeads,nReps:t.numHeads/t.kvNumHeads,pastPresentShareBuffer:!1,maskType:b,scale:t.scale,broadcastResPosBias:!1,passPastInKv:z,qkvFormat:x}},Qd=he({perm:[0,2,1,3]}),En=(e,t,r)=>{let i=t,n=r.kvNumHeads;return t.dims.length===3&&r.kvSequenceLength!==0&&(i=t.reshape([r.batchSize,r.kvSequenceLength,n,r.headSize]),i=e.compute(Pe(i,Qd.perm),{inputs:[i],outputs:[-1]})[0]),i},Yd=(e,t,r,i)=>{let n=7,a=["type","type"],s=[e*t],u=e*t,l=[{type:12,data:u},{type:12,data:t},{type:12,data:e}],d=c=>{let f=N("seq_lens",r.dataType,r.dims),g=N("total_seq_lens",i.dataType,i.dims),_=F("pos_ids",n,s),y=[{name:"output_size",type:"u32"},{name:"sequence_length",type:"u32"},{name:"batch_size",type:"u32"}];return`
  ${c.registerUniforms(y).declareVariables(f,g,_)}
  ${c.mainStart()}
    ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let total_sequence_length = u32(${g.getByOffset("0")});
    let is_subsequent_prompt = uniforms.sequence_length > 1 && uniforms.sequence_length != total_sequence_length;
    let is_first_prompt = !is_subsequent_prompt && uniforms.sequence_length == total_sequence_length;
    let batch_idx = global_idx / uniforms.sequence_length;
    let sequence_idx = i32(global_idx % uniforms.sequence_length);
    var pos_id: i32 = 0;
    let seqlen = ${f.getByOffset("batch_idx")};
    let total_seqlen = seqlen + 1;
    if (is_first_prompt) {
      if (sequence_idx < total_seqlen) {
        pos_id = sequence_idx;
      } else {
        pos_id = 1;
      }
      ${_.setByOffset("global_idx","pos_id")}
    } else if (is_subsequent_prompt) {
      let past_seqlen = total_seqlen - i32(uniforms.sequence_length);
      if (past_seqlen + sequence_idx < total_seqlen) {
        pos_id = past_seqlen + sequence_idx;
      } else {
        pos_id = 1;
      }
      ${_.setByOffset("global_idx","pos_id")}
    } else if (global_idx < uniforms.batch_size) {
      ${_.setByOffset("global_idx","seqlen")}
    };
  }
  `};return{name:"GeneratePositionIds",shaderCache:{hint:`${e};${t}`,inputDependencies:a},getRunData:()=>({outputs:[{dims:s,dataType:n}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:l}),getShaderSource:d}},Jd=(e,t)=>{let r=Xd(e.inputs,t);if(e.inputs[0].dims.length===5)throw new Error("Packed QKV is not implemented");if(e.inputs[1]?.dims.length===5)throw new Error("Packed KV is not implemented");let i=e.inputs[0],n=e.inputs[1]&&e.inputs[1].dims.length>0?e.inputs[1]:void 0,a=e.inputs[2]&&e.inputs[2].dims.length>0?e.inputs[2]:void 0,s=e.inputs[3]&&e.inputs[3].dims.length!==0?e.inputs[3]:void 0,u=e.inputs[4]&&e.inputs[4].dims.length!==0?e.inputs[4]:void 0,l=e.inputs.length>4?e.inputs[5]:void 0,d=e.inputs.length>5?e.inputs[6]:void 0,c=r.kvNumHeads?r.kvNumHeads:r.numHeads,f=he({axis:2,numOutputs:3,splitSizes:[r.numHeads*r.headSize,c*r.headSize,c*r.headSize]}),[g,_,y]=!n&&!a?e.compute(zn([i],f),{inputs:[i],outputs:[-1,-1,-1]}):[i,n,a],$,S;if(t.doRotary){let k=e.compute(Yd(r.batchSize,r.sequenceLength,l,d),{inputs:[l,d],outputs:[-1]})[0],E=e.inputs[7],A=e.inputs[8],C=he({interleaved:t.rotaryInterleaved!==0,numHeads:r.numHeads,rotaryEmbeddingDim:0,scale:t.scale}),v=[g,k,E,A],D=[-1];$=e.compute(Gr(v,C),{inputs:v,outputs:D})[0],v.splice(0,1,_);let q=he({interleaved:t.rotaryInterleaved!==0,numHeads:r.kvNumHeads,rotaryEmbeddingDim:0,scale:t.scale});S=e.compute(Gr(v,q),{inputs:v,outputs:D})[0]}let x=pr(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,t.doRotary?$:g,void 0,0),b=En(e,t.doRotary?S:_,r),z=En(e,y,r);sr(e,x,b,z,void 0,void 0,s,u,void 0,r,l,d)}}),In,ep,tp,rp,l0=U(()=>{te(),ie(),ft(),ne(),In=(e,t,r,i,n,a,s,u)=>{let l=xe(a),d=l===1?"f32":`vec${l}f`,c=l===1?"vec2f":`mat2x${l}f`,f=n*s,g=64;f===1&&(g=256);let _=[n,s,a/l],y=[n,s,2],$=["rank","type","type"],S=[];S.push(...K(_,y));let x=b=>{let z=N("x",t.dataType,3,l),k=N("scale",r.dataType,r.dims),E=N("bias",i.dataType,i.dims),A=F("output",1,3,2),C=[z,k,E,A];return`
  var<workgroup> workgroup_shared : array<${c}, ${g}>;
  const workgroup_size = ${g}u;
  ${b.declareVariables(...C)}
  ${b.mainStart(g)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${d}(0);
    var squared_sum = ${d}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${d}(${z.get("batch","channel","h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${c}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${ht("workgroup_shared[0][0]",l)} / f32(hight * ${l});
      let squared_sum_final = ${ht("workgroup_shared[0][1]",l)} / f32(hight * ${l});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${u}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`};return e.compute({name:"InstanceNormComputeChannelScaleShift",shaderCache:{hint:`${l};${u};${g}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:y,dataType:1}],dispatchGroup:{x:f},programUniforms:S}),getShaderSource:x},{inputs:[t,r,i],outputs:[-1]})[0]},ep=(e,t,r)=>{let i=t[0].dims,n=i,a=2,s=i[0],u=i[1],l=O.sizeFromDimension(i,a),d=xe(l),c=O.size(n)/d,f=In(e,t[0],t[1],t[2],s,l,u,r.epsilon),g=[s,u,l/d],_=[s,u],y=["type","none"],$=S=>{let x=N("x",t[0].dataType,g.length,d),b=N("scale_shift",1,_.length,2),z=F("output",t[0].dataType,g.length,d),k=[x,b,z];return`
  ${S.registerUniform("output_size","u32").declareVariables(...k)}
  ${S.mainStart()}
  ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${z.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${b.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${x.getByOffset("global_idx")} * ${z.type.value}(scale_shift.x) + ${z.type.value}(scale_shift.y);
      ${z.setByOffset("global_idx","value")};
  }`};e.compute({name:"InstanceNormalization",shaderCache:{hint:`${d}`,inputDependencies:y},getRunData:()=>({outputs:[{dims:n,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(c/64)},programUniforms:[{type:12,data:c},...K(g,_,g)]}),getShaderSource:$},{inputs:[t[0],f]})},tp=(e,t,r)=>{let i=t[0].dims,n=i,a=i[0],s=i[i.length-1],u=O.sizeFromDimension(i,1)/s,l=xe(s),d=O.size(n)/l,c=[{type:12,data:u},{type:12,data:Math.floor(s/l)}],f=["type","type"],g=!1,_=[0,i.length-1];for(let x=0;x<i.length-2;x++)g=g||i[x+1]!==1,_.push(x+1);g=g&&i[i.length-1]!==1;let y=g?e.compute(Pe(e.inputs[0],_),{inputs:[e.inputs[0]],outputs:[-1]})[0]:e.inputs[0].reshape(Array.from({length:i.length},(x,b)=>i[_[b]])),$=In(e,y,t[1],t[2],a,u,s,r.epsilon),S=x=>{let b=ze(t[0].dataType),z=l===1?"vec2f":`mat${l}x2f`,k=C=>{let v=C===0?"x":"y",D=l===1?"f32":`vec${l}f`;switch(l){case 1:return`${b}(${D}(scale.${v}))`;case 2:return`vec2<${b}>(${D}(scale[0].${v}, scale[1].${v}))`;case 4:return`vec4<${b}>(${D}(scale[0].${v}, scale[1].${v}, scale[2].${v}, scale[3].${v}))`;default:throw new Error(`Not supported compoents ${l}`)}},E=N("input",t[0].dataType,t[0].dims,l),A=F("output",t[0].dataType,n,l);return`
  @group(0) @binding(0) var<storage, read> input : array<${E.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${z}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${A.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${x.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${k(0)}, ${k(1)});
  }`};e.compute({name:"InstanceNormalizationNHWC",shaderCache:{hint:`${l}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:n,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(d/64)},programUniforms:c}),getShaderSource:S},{inputs:[t[0],$]})},rp=(e,t)=>{t.format==="NHWC"?tp(e,e.inputs,t):ep(e,e.inputs,t)}}),ip,np,ap,d0=U(()=>{te(),ie(),ne(),ip=e=>{if(!e||e.length<2)throw new Error("layerNorm requires at least 2 inputs.")},np=(e,t,r)=>{let i=t.simplified,n=e[0].dims,a=e[1],s=!i&&e[2],u=n,l=O.normalizeAxis(t.axis,n.length),d=O.sizeToDimension(n,l),c=O.sizeFromDimension(n,l),f=O.size(a.dims),g=s?O.size(s.dims):0;if(f!==c||s&&g!==c)throw new Error(`Size of X.shape()[axis:] == ${c}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${f} and bias size of ${g}`);let _=[];for(let E=0;E<n.length;++E)E<l?_.push(n[E]):_.push(1);let y=xe(c),$=["type","type"],S=[{type:12,data:d},{type:1,data:c},{type:12,data:Math.floor(c/y)},{type:1,data:t.epsilon}];s&&$.push("type");let x=r>1,b=r>2,z=E=>{let A=ze(e[0].dataType),C=[N("x",e[0].dataType,e[0].dims,y),N("scale",a.dataType,a.dims,y)];s&&C.push(N("bias",s.dataType,s.dims,y)),C.push(F("output",e[0].dataType,u,y)),x&&C.push(F("mean_data_output",1,_)),b&&C.push(F("inv_std_output",1,_));let v=[{name:"norm_count",type:"u32"},{name:"norm_size",type:"f32"},{name:"norm_size_vectorized",type:"u32"},{name:"epsilon",type:"f32"}];return`
  ${E.registerUniforms(v).declareVariables(...C)}
  ${E.mainStart()}
    ${E.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${Zi("f32",y)};
    var mean_square_vector = ${Zi("f32",y)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${Ht(A,y,"x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${ht("mean_vector",y)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${ht("mean_square_vector",y)} / uniforms.norm_size ${i?"":"- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${Ht(A,y,"x[j + offset]")};
      let f32scale = ${Ht(A,y,"scale[j]")};
      output[j + offset] = ${C[0].type.value}((f32input ${i?"":"- mean"}) * inv_std_dev * f32scale
        ${s?`+ ${Ht(A,y,"bias[j]")}`:""}
      );
    }

    ${x?"mean_data_output[global_idx] = mean":""};
    ${b?"inv_std_output[global_idx] = inv_std_dev":""};
  }`},k=[{dims:u,dataType:e[0].dataType}];return x&&k.push({dims:_,dataType:1}),b&&k.push({dims:_,dataType:1}),{name:"LayerNormalization",shaderCache:{hint:`${y};${r};${i}`,inputDependencies:$},getRunData:()=>({outputs:k,dispatchGroup:{x:Math.ceil(d/64)},programUniforms:S}),getShaderSource:z}},ap=(e,t)=>{ip(e.inputs),e.compute(np(e.inputs,t,e.outputCount))}}),sp,op,p0=U(()=>{ie(),pn(),mn(),sp=e=>{if(!e||e.length!==2)throw new Error("MatMul requires 2 inputs.");if(e[0].dims[e[0].dims.length-1]!==e[1].dims[e[1].dims.length-2])throw new Error("shared dimension does not match.")},op=e=>{sp(e.inputs);let t=Gt.calcShape(e.inputs[0].dims,e.inputs[1].dims,!0);if(!t)throw new Error("Can't use matmul on the given tensors");let r=t[t.length-1],i=e.inputs[0].dims[e.inputs[0].dims.length-1];if(r<8&&i<8)e.compute(dn(e.inputs,{activation:""},t));else{let n=t[t.length-2],a=O.size(e.inputs[0].dims.slice(0,-2)),s=O.size(e.inputs[1].dims.slice(0,-2));if(a!==1&&n===1&&s===1){let u=e.inputs[0].reshape([1,a,i]),l=e.inputs[1].reshape([1,i,r]),d=[1,a,r],c=[u,l];e.compute(qr(c,{activation:""},t,d),{inputs:c})}else e.compute(qr(e.inputs,{activation:""},t))}}}),up,lp,dp,pp,cp,c0=U(()=>{te(),ie(),ke(),ne(),up=(e,t)=>{if(e.length<3||e.length>4)throw new Error("MatMulNBits requires 3 or 4 inputs");let r=e[0],i=r.dims.length;if(r.dims[i-1]!==t.k)throw new Error("The last dim of input shape does not match the k value");let n=Math.floor((t.k+t.blockSize-1)/t.blockSize),a=t.blockSize/8*t.bits,s=e[1];if(!O.areEqual(s.dims,[t.n,n,a]))throw new Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");let u=e[2].dims;if(O.size(u)!==t.n*n)throw new Error("scales input size error.");if(e.length===4){let l=e[3].dims,d=t.n*(t.bits===8?n:Math.floor((n*t.bits+7)/8));if(O.size(l)!==d)throw new Error("zeroPoints input size error.")}},lp=(e,t)=>{let r=e[0].dims,i=r.length,n=r[i-2],a=t.k,s=t.n,u=r.slice(0,i-2),l=O.size(u),d=e[1].dims[2]/4,c=e[0].dataType,f=xe(t.k),g=xe(d),_=xe(s),y=u.concat([n,s]),$=n>1&&s/_%2===0?2:1,S=O.size(y)/_/$,x=64,b=[],z=[l,n,a/f],k=O.convertShape(e[1].dims).slice();k.splice(-1,1,d/g),b.push(...K(z)),b.push(...K(k)),b.push(...K(e[2].dims)),e.length===4&&b.push(...K(O.convertShape(e[3].dims)));let E=[l,n,s/_];b.push(...K(E));let A=C=>{let v=z.length,D=N("a",e[0].dataType,v,f),q=N("b",12,k.length,g),Q=N("scales",e[2].dataType,e[2].dims.length),H=[D,q,Q],Z=e.length===4?N("zero_points",12,e[3].dims.length):void 0;Z&&H.push(Z);let R=E.length,M=F("output",e[0].dataType,R,_),G=ze(e[0].dataType),J=(()=>{switch(f){case 1:return`array<${G}, 8>`;case 2:return`mat4x2<${G}>`;case 4:return`mat2x4<${G}>`;default:throw new Error(`${f}-component is not supported.`)}})(),ee=Math.floor(32/t.bits),re=Math.floor(ee/8),ae=()=>{let X="";for(let V=0;V<re;V++){let Te=V*t.bits*4,Ce=Te+t.bits;X+=`
          // reuse a data (pass ${V})
            var input_offset${V>0?V:""} = ${V===0?D.indicesToOffset(`${D.type.indices}(batch, row, word_offset)`):"input_offset"};
            var a_data${V>0?V:""}: ${J};
            for (var j${V>0?V:""}: u32 = 0; j${V>0?V:""} < ${8/f}; j${V>0?V:""}++) {
              a_data${V>0?V:""}[j${V>0?V:""}] = ${D.getByOffset(`input_offset${V>0?V:""}`)};
              input_offset${V>0?V:""}++;
            }
          `;for(let $e=0;$e<_*$;$e++)X+=`
            b_value = ${g===1?`b${$e}_data`:`b${$e}_data[i]`};
            ${t.bits===2?`{
              let half_word = b_value >> ${V*16}u;
              let byte_lo = half_word & 0xFFu;
              let byte_hi = (half_word >> 8u) & 0xFFu;
              let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
              b_value_lower = unpack4xU8(spread_word & b_mask);
              b_value_upper = unpack4xU8((spread_word >> 2u) & b_mask);
            }`:`b_value_lower = unpack4xU8((b_value >> ${Te}u) & b_mask);
            b_value_upper = unpack4xU8((b_value >> ${Ce}u) & b_mask);`}
            b_quantized_values = ${J}(${Array.from({length:4},(Ae,me)=>`${G}(b_value_lower[${me}]), ${G}(b_value_upper[${me}])`).join(", ")});
            b_dequantized_values = ${f===1?`${J}(${Array.from({length:8},(Ae,me)=>`(b_quantized_values[${me}] - ${Z?`zero_point${$e}`:"zero_point"}) * scale${$e}`).join(", ")});`:`(b_quantized_values - ${J}(${Array(8).fill(`${Z?`zero_point${$e}`:"zero_point"}`).join(",")})) * scale${$e};`};
            workgroup_shared[local_id.x * ${$} + ${Math.floor($e/_)}]${_>1?`[${$e%_}]`:""} += ${Array.from({length:8/f},(Ae,me)=>`${f===1?`a_data${V>0?V:""}[${me}] * b_dequantized_values[${me}]`:`dot(a_data${V>0?V:""}[${me}], b_dequantized_values[${me}])`}`).join(" + ")};
          `}return X},P=()=>{let X=`
            var col_index = col * ${_};
            ${Z?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (nBlocksPerCol + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is ${Math.pow(2,t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${G}(${Math.pow(2,t.bits-1).toFixed(1)});`}
            `;for(let V=0;V<_*$;V++)X+=`
            let scale${V} = ${Q.getByOffset("col_index * nBlocksPerCol + block")};
            ${Z?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            zero_point_word = ${Z.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${V} = ${G}((zero_point_word) & ${t.bits===2?"0x3u":"0xFu"});`:""}
            col_index += 1;`;return X},Y=()=>{let X=`col_index = col * ${_};`;for(let V=0;V<_*$;V++)X+=`
            let b${V}_data = ${q.getByIndices(`${q.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return X+=`
            var b_value: u32;
            let b_mask: u32 = ${t.bits===2?"0x03030303u":"0x0F0F0F0Fu"};
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${J};
            var b_dequantized_values: ${J};`,X};return`
        var<workgroup> workgroup_shared: array<${M.type.value}, ${$*x}>;
        ${C.declareVariables(...H,M)}
        ${C.mainStart([x,1,1])}
          let output_indices = ${M.offsetToIndices(`(global_idx / ${x}) * ${$}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${x}) {
            //process one block
            var word_offset: u32 = block * ${t.blockSize/f};
            ${P()}
            for (var word: u32 = 0; word < ${d}; word += ${g}) {
              ${Y()}
              for (var i: u32 = 0; i < ${g}; i++) {
                ${ae()}
                word_offset += ${ee/f};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${$}) {
            var output_value: ${M.type.value} = ${M.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${x}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${$};
            }
            ${M.setByIndices(`${M.type.indices}(batch, row, col + local_id.x)`,"output_value")};
          }
        }`};return{name:"MatMulNBits",shaderCache:{hint:`${t.blockSize};${t.bits};${f};${g};${_};${$};${x}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:y,dataType:c}],dispatchGroup:{x:S},programUniforms:b}),getShaderSource:A}},dp=(e,t)=>{let r=e[0].dims,i=r.length,n=r[i-2],a=t.k,s=t.n,u=r.slice(0,i-2),l=O.size(u),d=e[1].dims[2]/4,c=e[0].dataType,f=xe(t.k),g=xe(d),_=u.concat([n,s]),y=128,$=s%8===0?8:s%4===0?4:1,S=y/$,x=Math.floor(32/t.bits),b=S*g*x,z=b/f,k=b/t.blockSize,E=O.size(_)/$,A=[],C=[l,n,a/f],v=O.convertShape(e[1].dims).slice();v.splice(-1,1,d/g),A.push(...K(C)),A.push(...K(v)),A.push(...K(e[2].dims)),e.length===4&&A.push(...K(O.convertShape(e[3].dims)));let D=[l,n,s];A.push(...K(D));let q=Q=>{let H=C.length,Z=N("a",e[0].dataType,H,f),R=N("b",12,v.length,g),M=N("scales",e[2].dataType,e[2].dims.length),G=[Z,R,M],J=e.length===4?N("zero_points",12,e[3].dims.length):void 0;J&&G.push(J);let ee=D.length,re=F("output",e[0].dataType,ee),ae=ze(e[0].dataType),P=()=>{switch(f){case 1:return`
          let a_data0 = vec4<${ae}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${ae}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${ae}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${ae}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw new Error(`${f}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${Z.type.value}, ${z}>;
        var<workgroup> inter_results: array<array<${re.type.value}, ${S}>, ${$}>;
        ${Q.declareVariables(...G,re)}
        ${Q.mainStart([S,$,1])}
          let output_indices = ${re.offsetToIndices(`workgroup_index * ${$}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${k} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${z};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${z}; a_offset += ${y})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${Z.getByIndices(`${Z.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${Z.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${k} + local_id.x;
            ${J?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (n_blocks_per_col + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            let zero_point_word = ${J.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${ae}((zero_point_word) & ${t.bits===2?"0x3u":"0xFu"});`:`
            // The default zero point is ${Math.pow(2,t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${ae}(${Math.pow(2,t.bits-1).toFixed(1)});`}
            let scale = ${M.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${R.getByIndices(`${R.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${t.blockSize/f};
            for (var i: u32 = 0; i < ${g}; i++) {
              let b_value = ${g===1?"b_data":"b_data[i]"};
              ${(()=>{let Y=Math.floor(x/8),X="";for(let V=0;V<Y;V++){let Te=V*t.bits*4,Ce=Te+t.bits;X+=`
              ${P()}
              {${t.bits===2?`
                let half_word = b_value >> ${V*16}u;
                let byte_lo = half_word & 0xFFu;
                let byte_hi = (half_word >> 8u) & 0xFFu;
                let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
                let b_value_lower = unpack4xU8(spread_word & 0x03030303u);
                let b_value_upper = unpack4xU8((spread_word >> 2u) & 0x03030303u);`:`
                let b_value_lower = unpack4xU8((b_value >> ${Te}u) & 0x0F0F0F0Fu);
                let b_value_upper = unpack4xU8((b_value >> ${Ce}u) & 0x0F0F0F0Fu);`}
                let b_quantized_values = mat2x4<${ae}>(${Array.from({length:4},($e,Ae)=>`${ae}(b_value_lower[${Ae}]), ${ae}(b_value_upper[${Ae}])`).join(", ")});
                let b_dequantized_values = (b_quantized_values - mat2x4<${ae}>(${Array(8).fill("zero_point").join(",")})) * scale;
                inter_results[local_id.y][local_id.x] += ${Array.from({length:2},($e,Ae)=>`${`dot(a_data${Ae}, b_dequantized_values[${Ae}])`}`).join(" + ")};
              }
              word_offset += ${8/f};`}return X})()}
            }
            workgroupBarrier();
          }

          if (local_idx < ${$}) {
            var output_value: ${re.type.value} = ${re.type.value}(0);
            for (var b = 0u; b < ${S}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${re.setByIndices(`${re.type.indices}(batch, row, col + local_idx)`,"output_value")}
            }
          }
        }`};return{name:"BlockwiseMatMulNBits32",shaderCache:{hint:`${t.blockSize};${f};${g};${S};${$}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:_,dataType:c}],dispatchGroup:{x:E},programUniforms:A}),getShaderSource:q}},pp=(e,t)=>{up(e.inputs,t),t.blockSize===32&&e.adapterInfo.isVendor("intel")&&e.adapterInfo.isArchitecture("gen-12lp")?e.compute(dp(e.inputs,t)):e.compute(lp(e.inputs,t))},cp=e=>he(e)}),hp,fp,mp,gp,_p,yp,bp,wp,$p,h0=U(()=>{te(),ie(),ne(),hp=e=>{if(!e||e.length<1)throw new Error("Too few inputs");if(e[0].dataType!==1&&e[0].dataType!==10)throw new Error("Input type must be float or float16.");if(e.length>=2){let t=e[0].dims.length*2===e[1].dims[0];if(e.length===4&&(t=e[3].dims[0]*2===e[1].dims[0]),!t)throw new Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].")}},fp=(e,t,r)=>{let i="";for(let n=t-1;n>=0;--n)i+=`
            k = i32(${e.indicesGet("indices",n)}) - ${j("uniforms.pads",n,r)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${j("uniforms.x_shape",n,t)})) {
              break;
            }
            offset += k * i32(${j("uniforms.x_strides",n,t)});
        `;return`
          value = ${e.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${i}
            value = x[offset];
          }
      `},mp=(e,t,r)=>{let i="";for(let n=t-1;n>=0;--n)i+=`
                k = i32(${e.indicesGet("indices",n)}) - ${j("uniforms.pads",n,r)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${j("uniforms.x_shape",n,t)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${j("uniforms.x_shape",n,t)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${j("uniforms.x_strides",n,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},gp=(e,t,r)=>{let i="";for(let n=t-1;n>=0;--n)i+=`
                k = i32(${e.indicesGet("indices",n)}) - ${j("uniforms.pads",n,r)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${j("uniforms.x_shape",n,t)})) {
                  k = i32(${j("uniforms.x_shape",n,t)}) - 1;
                }
                offset += k * i32(${j("uniforms.x_strides",n,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},_p=(e,t,r)=>{let i="";for(let n=t-1;n>=0;--n)i+=`
                k = i32(${e.indicesGet("indices",n)}) - ${j("uniforms.pads",n,r)};
                if (k < 0)  {
                  k += i32(${j("uniforms.x_shape",n,t)}]);
                }
                if (k >= i32(${j("uniforms.x_shape",n,t)})) {
                  k -= i32(${j("uniforms.x_shape",n,t)});
                }
                offset += k * i32(${j("uniforms.x_strides",n,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},yp=(e,t,r)=>{switch(r.mode){case 0:return fp(e,t,r.pads.length);case 1:return mp(e,t,r.pads.length);case 2:return gp(e,t,r.pads.length);case 3:return _p(e,t,r.pads.length);default:throw new Error("Invalid mode")}},bp=(e,t)=>{let r=O.padShape(e[0].dims.slice(),t.pads),i=e[0].dims,n=O.size(r),a=[{type:12,data:n},{type:6,data:t.pads}],s=e.length>=3&&e[2].data;t.mode===0&&a.push({type:s?e[2].dataType:1,data:t.value}),a.push(...K(e[0].dims,r));let u=["rank"],l=d=>{let c=F("output",e[0].dataType,r.length),f=N("x",e[0].dataType,i.length),g=f.type.value,_=yp(c,i.length,t),y=[{name:"output_size",type:"u32"},{name:"pads",type:"i32",length:t.pads.length}];return t.mode===0&&y.push({name:"constant_value",type:s?g:"f32"}),`
            ${d.registerUniforms(y).declareVariables(f,c)}
            ${d.mainStart()}
            ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${c.offsetToIndices("global_idx")};

            var value = ${g}(0);
            ${_}
            output[global_idx] = value;
        }`};return{name:"Pad",shaderCache:{hint:`${t.mode}${s}`,inputDependencies:u},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(O.size(r)/64)},programUniforms:a}),getShaderSource:l}},wp=(e,t)=>{if(e.length>1){let r=e[1].getBigInt64Array(),i=e.length>=3&&e[2].data?e[2].dataType===10?e[2].getUint16Array()[0]:e[2].getFloat32Array()[0]:0,n=e[0].dims.length,a=new Int32Array(2*n).fill(0);if(e.length>=4){let u=e[3].getBigInt64Array();for(let l=0;l<u.length;l++)a[Number(u[l])]=Number(r[l]),a[Number(u[l])+n]=Number(r[l+u.length])}else r.forEach((u,l)=>a[Number(l)]=Number(u));let s=[];return a.forEach(u=>s.push(u)),{mode:t.mode,value:i,pads:s}}else return t},$p=(e,t)=>{hp(e.inputs);let r=wp(e.inputs,t);e.compute(bp(e.inputs,r),{inputs:[0]})}}),cr,Cn,An,On,Rn,vp,xp,Bn,Nn,kp,Sp,Mn,Tp,zp,Dn,Ep,Ip,Cp,Ap,f0=U(()=>{Ue(),te(),ie(),ne(),cr=e=>{if(be.webgpu.validateInputContent&&(!e||e.length!==1))throw new Error("Pool ops requires 1 input.")},Cn=(e,t,r)=>{let i=t.format==="NHWC",n=e.dims.slice();i&&n.splice(1,0,n.pop());let a=Object.hasOwnProperty.call(t,"dilations"),s=t.kernelShape.slice(),u=t.strides.slice(),l=a?t.dilations.slice():[],d=t.pads.slice();Rr.adjustPoolAttributes(r,n,s,u,l,d);let c=Rr.computePoolOutputShape(r,n,u,l,s,d,t.autoPad),f=Object.assign({},t);a?Object.assign(f,{kernelShape:s,strides:u,pads:d,dilations:l,cacheKey:t.cacheKey}):Object.assign(f,{kernelShape:s,strides:u,pads:d,cacheKey:t.cacheKey});let g=c.slice();return g.push(g.splice(1,1)[0]),[f,i?g:c]},An=(e,t)=>{let r=t.format==="NHWC",i=O.size(e),n=O.size(t.kernelShape),a=[{type:12,data:i},{type:12,data:n}],s=[{name:"outputSize",type:"u32"},{name:"kernelSize",type:"u32"}];if(t.kernelShape.length<=2){let u=t.kernelShape[t.kernelShape.length-1],l=t.strides[t.strides.length-1],d=t.pads[t.pads.length/2-1],c=t.pads[t.pads.length-1],f=!!(d+c);a.push({type:12,data:u},{type:12,data:l},{type:12,data:d},{type:12,data:c}),s.push({name:"kw",type:"u32"},{name:"sw",type:"u32"},{name:"pwStart",type:"u32"},{name:"pwEnd",type:"u32"});let g=!1;if(t.kernelShape.length===2){let _=t.kernelShape[t.kernelShape.length-2],y=t.strides[t.strides.length-2],$=t.pads[t.pads.length/2-2],S=t.pads[t.pads.length-2];g=!!($+S),a.push({type:12,data:_},{type:12,data:y},{type:12,data:$},{type:12,data:S}),s.push({name:"kh",type:"u32"},{name:"sh",type:"u32"},{name:"phStart",type:"u32"},{name:"phEnd",type:"u32"})}return[a,s,!0,f,g]}else{if(r)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let u=O.computeStrides(t.kernelShape);a.push({type:12,data:u},{type:12,data:t.pads},{type:12,data:t.strides}),s.push({name:"kernelStrides",type:"u32",length:u.length},{name:"pads",type:"u32",length:t.pads.length},{name:"strides",type:"u32",length:t.strides.length});let l=t.pads.reduce((d,c)=>d+c);return[a,s,!!l,!1,!1]}},On=(e,t,r,i,n,a,s,u,l,d,c,f)=>{let g=n.format==="NHWC",_=t.type.value,y=F("output",t.type.tensor,i);if(n.kernelShape.length<=2){let $="",S="",x="",b=r-(g?2:1);if(c?$=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${b}] = indices[${b}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${b}] < 0 || xIndices[${b}]
                      >= uniforms.x_shape[${b}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${a}
                }`:$=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${b}] = indices[${b}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${a}
                }`,n.kernelShape.length===2){let z=r-(g?3:2);f?S=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${z}] = indices[${z}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${z}] < 0 || xIndices[${z}] >= uniforms.x_shape[${z}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:S=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${z}] = indices[${z}] * uniforms.sh - uniforms.phStart + j;
                `,x=`
              }
            `}return`
            ${e.registerUniforms(l).declareVariables(t,y)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${y.offsetToIndices("global_idx")};
              var xIndices = ${y.offsetToIndices("global_idx")};

              var value = ${_}(${u});
              var pad = 0;
              ${S}
              ${$}
              ${x}
              ${s}

              output[global_idx] = value;
            }`}else{if(g)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let $=n.kernelShape.length,S=n.pads.length,x="";return d?x=`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${t.indicesToOffset("xIndices")}];
                ${a}
              }`:x=`
              }
              let x_val = x[${t.indicesToOffset("xIndices")}];
              ${a}
            `,`
            ${e.registerUniforms(l).declareVariables(t,y)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${y.offsetToIndices("global_idx")};
              var xIndices = ${y.offsetToIndices("global_idx")};

              var offsets: array<u32, ${$}>;

              var value = ${_}(${u});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${$-1}u; j++) {
                  offsets[j] = offset / ${j("uniforms.kernelStrides","j",$)};
                  offset -= offsets[j] * ${j("uniforms.kernelStrides","j",$)};
                }
                offsets[${$-1}] = offset;

                isPad = false;
                for (var j = ${r-$}u; j < ${r}u; j++) {
                  xIndices[j] = indices[j] * ${j("uniforms.strides",`j - ${r-$}u`,$)}
                    + offsets[j - ${r-$}u] - ${j("uniforms.pads","j - 2u",S)};
                  ${x}
              }
              ${s}

              output[global_idx] = value;
            }`}},Rn=e=>`${e.format};${e.ceilMode};${e.autoPad};${e.kernelShape.length}`,vp=e=>`${Rn(e)};${e.countIncludePad}`,xp=e=>`${Rn(e)};${e.storageOrder};${e.dilations}`,Bn=e=>({format:e.format,autoPad:["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],ceilMode:e.ceil_mode,kernelShape:e.kernel_shape,strides:e.strides,pads:e.pads}),Nn=(e,t,r,i)=>{let[n,a]=Cn(t,i,r),s=N("x",t.dataType,t.dims.length),u=s.type.value,l="value += x_val;",d="";n.countIncludePad?d+=`value /= ${u}(uniforms.kernelSize);`:d+=`value /= ${u}(i32(uniforms.kernelSize) - pad);`;let[c,f,g,_,y]=An(a,n);c.push(...K(t.dims,a));let $=["rank"];return{name:e,shaderCache:{hint:`${i.cacheKey};${g};${_};${y}`,inputDependencies:$},getRunData:()=>({outputs:[{dims:a,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(O.size(a)/64)},programUniforms:c}),getShaderSource:S=>On(S,s,t.dims.length,a.length,n,l,d,0,f,g,_,y)}},kp=e=>{let t=e.count_include_pad!==0,r=Bn(e);if(r.ceilMode!==0)throw new Error("using ceil() in shape computation is not yet supported for AveragePool");let i={countIncludePad:t,...r,cacheKey:""};return{...i,cacheKey:vp(i)}},Sp=(e,t)=>{cr(e.inputs),e.compute(Nn("AveragePool",e.inputs[0],!1,t))},Mn={autoPad:"",ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},Tp=e=>{let t=e.format;return{format:t,...Mn,cacheKey:t}},zp=(e,t)=>{cr(e.inputs),e.compute(Nn("GlobalAveragePool",e.inputs[0],!0,t))},Dn=(e,t,r,i)=>{let[n,a]=Cn(t,i,r),s=`
      value = max(x_val, value);
    `,u="",l=N("x",t.dataType,t.dims.length),d=["rank"],[c,f,g,_,y]=An(a,n);return c.push(...K(t.dims,a)),{name:e,shaderCache:{hint:`${i.cacheKey};${g};${_};${y}`,inputDependencies:d},getRunData:()=>({outputs:[{dims:a,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(O.size(a)/64)},programUniforms:c}),getShaderSource:$=>On($,l,t.dims.length,a.length,n,s,u,t.dataType===10?-65504:-1e5,f,g,_,y)}},Ep=(e,t)=>{cr(e.inputs),e.compute(Dn("MaxPool",e.inputs[0],!1,t))},Ip=e=>{let t=e.storage_order,r=e.dilations,i=Bn(e);if(t!==0)throw new Error("column major storage order is not yet supported for MaxPool");if(i.ceilMode!==0)throw new Error("using ceil() in shape computation is not yet supported for MaxPool");let n={storageOrder:t,dilations:r,...i,cacheKey:""};return{...n,cacheKey:xp(n)}},Cp=e=>{let t=e.format;return{format:t,...Mn,cacheKey:t}},Ap=(e,t)=>{cr(e.inputs),e.compute(Dn("GlobalMaxPool",e.inputs[0],!0,t))}}),Op,Rp,Bp,Np,m0=U(()=>{te(),ie(),ke(),ne(),Op=(e,t)=>{if(e.length<2||e.length>3)throw new Error("DequantizeLinear requires 2 or 3 inputs.");if(e.length===3&&e[1].dims===e[2].dims)throw new Error("x-scale and x-zero-point must have the same shape.");if(e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==0&&e[1].dims.length!==1&&e[1].dims.length!==e[0].dims.length)throw new Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");if(e.length>2){if(e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==e[2].dims.length)throw new Error("scale and zero-point inputs must have the same rank.");if(!e[1].dims.map((r,i)=>r===e[2].dims[i]).reduce((r,i)=>r&&i,!0))throw new Error("scale and zero-point inputs must have the same shape.")}if(t.blockSize>0){if(e[1].dims.length===0||e[1].dims.length===1&&e[1].dims[0]===1)throw new Error("blockSize must be set only for block quantization.");if(!e[1].dims.map((n,a)=>a===t.axis||n===e[0].dims[a]).reduce((n,a)=>n&&a,!0))throw new Error("For block qunatization, scale input shape to match the input shape except for the axis");if(e[1].dims.length!==e[0].dims.length)throw new Error("For block qunatization the scale input rank must be the same as the x rank.");let r=e[0].dims[t.axis],i=e[1].dims[t.axis];if(t.blockSize<Math.ceil(r/i)||t.blockSize>Math.ceil(r/(i-1)-1))throw new Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].")}},Rp=(e,t)=>{let r=O.normalizeAxis(t.axis,e[0].dims.length),i=e[0].dataType,n=i===3,a=e[0].dims,s=e[1].dataType,u=O.size(a),l=i===3||i===2,d=l?[Math.ceil(O.size(e[0].dims)/4)]:e[0].dims,c=e[1].dims,f=e.length>2?e[2]:void 0,g=f?l?[Math.ceil(O.size(f.dims)/4)]:f.dims:void 0,_=c.length===0||c.length===1&&c[0]===1,y=_===!1&&c.length===1,$=xe(u),S=_&&(!l||$===4),x=S?$:1,b=S&&!l?$:1,z=N("input",l?12:i,d.length,b),k=N("scale",s,c.length),E=f?N("zero_point",l?12:i,g.length):void 0,A=F("output",s,a.length,x),C=[z,k];E&&C.push(E);let v=[d,c];f&&v.push(g);let D=[{type:12,data:u/x},{type:12,data:r},{type:12,data:t.blockSize},...K(...v,a)],q=Q=>{let H=[{name:"output_size",type:"u32"},{name:"axis",type:"u32"},{name:"block_size",type:"u32"}];return`
      ${Q.registerUniforms(H).declareVariables(...C,A)}
      ${Q.mainStart()}
          ${Q.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${A.offsetToIndices("global_idx")};

          // Set input x
          ${l?`
            let input = ${z.getByOffset("global_idx / 4")};
            let x_vec = ${n?"unpack4xI8(input)":"unpack4xU8(input)"};
            let x_value = ${x===1?"x_vec[global_idx % 4]":"x_vec"};`:`let x_value = ${z.getByOffset("global_idx")};`};

          // Set scale input
          ${_?`let scale_value= ${k.getByOffset("0")}`:y?`
            let scale_index = ${A.indicesGet("output_indices","uniforms.axis")};
            let scale_value= ${k.getByOffset("scale_index")};`:`
            var scale_indices: ${k.type.indices} = output_indices;
            let index = ${k.indicesGet("scale_indices","uniforms.axis")} / uniforms.block_size;
            ${k.indicesSet("scale_indices","uniforms.axis","index")};
            let scale_value= ${k.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${E?_?l?`
                let zero_point_input = ${E.getByOffset("0")};
                let zero_point_vec =  ${n?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${E.getByOffset("0")}`:y?l?`
                let zero_point_index = ${A.indicesGet("output_indices","uniforms.axis")};
                let zero_point_input = ${E.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${n?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${A.indicesGet("output_indices","uniforms.axis")};
                let zero_point_value = ${E.getByOffset("zero_point_index")};`:l?`
                let zero_point_offset = ${k.indicesToOffset("scale_indices")};
                let zero_point_input = ${E.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${n?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${E.getByIndices("scale_indices")};`:`let zero_point_value = ${l?n?"i32":"u32":z.type.value}(0);`};
      // Compute and write output
      ${A.setByOffset("global_idx",`${A.type.value}(x_value - zero_point_value) * scale_value`)};
      }`};return{name:"DequantizeLinear",shaderCache:{hint:t.cacheKey,inputDependencies:E?["rank","rank","rank"]:["rank","rank"]},getShaderSource:q,getRunData:()=>({outputs:[{dims:a,dataType:s}],dispatchGroup:{x:Math.ceil(u/x/64),y:1,z:1},programUniforms:D})}},Bp=(e,t)=>{Op(e.inputs,t),e.compute(Rp(e.inputs,t))},Np=e=>he({axis:e.axis,blockSize:e.blockSize})}),Mp,Dp,Pp,g0=U(()=>{Ue(),te(),ne(),Mp=(e,t,r)=>{let i=e===t,n=e<t&&r<0,a=e>t&&r>0;if(i||n||a)throw new Error("Range these inputs' contents are invalid.")},Dp=(e,t,r,i)=>{let n=Math.abs(Math.ceil((t-e)/r)),a=[n],s=n,u=[{type:12,data:s},{type:i,data:e},{type:i,data:r},...K(a)],l=d=>{let c=F("output",i,a.length),f=c.type.value,g=[{name:"outputSize",type:"u32"},{name:"start",type:f},{name:"delta",type:f}];return`
        ${d.registerUniforms(g).declareVariables(c)}
        ${d.mainStart()}
        ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${f}(global_idx) * uniforms.delta;
      }`};return{name:"Range",shaderCache:{hint:`${i}`},getShaderSource:l,getRunData:()=>({outputs:[{dims:a,dataType:i}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:u})}},Pp=e=>{let t=0,r=0,i=0;e.inputs[0].dataType===6?(t=e.inputs[0].getInt32Array()[0],r=e.inputs[1].getInt32Array()[0],i=e.inputs[2].getInt32Array()[0]):e.inputs[0].dataType===1&&(t=e.inputs[0].getFloat32Array()[0],r=e.inputs[1].getFloat32Array()[0],i=e.inputs[2].getFloat32Array()[0]),be.webgpu.validateInputContent&&Mp(t,r,i),e.compute(Dp(t,r,i,e.inputs[0].dataType),{inputs:[]})}}),Up,qp,Lp,Wp,_0=U(()=>{te(),ie(),ke(),ne(),Up=(e,t,r,i)=>{if(e!=="none"&&i!=="i32"&&i!=="u32"&&i!=="f32")throw new Error(`Input ${i} is not supported with reduction ${e}.`);let n=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,a=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${t}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(e){case"none":return`${t}=${r};`;case"add":return i==="i32"||i==="u32"?`atomicAdd(&${t}, bitcast<${i}>(${r}));`:`
              ${n}bitcast<${i}>(oldValue) + (${r})${a}`;case"max":return i==="i32"||i==="u32"?`atomicMax(&${t}, bitcast<${i}>(${r}));`:`
                ${n}max(bitcast<f32>(oldValue), (${r}))${a}`;case"min":return i==="i32"||i==="u32"?`atomicMin(&${t}, bitcast<${i}>(${r}));`:`${n}min(bitcast<${i}>(oldValue), (${r}))${a}`;case"mul":return`${n}(bitcast<${i}>(oldValue) * (${r}))${a}`;default:throw new Error(`Reduction ${e} is not supported.`)}},qp=(e,t)=>{let r=e[0].dims,i=e[1].dims,n=r,a=1,s=Math.ceil(O.sizeToDimension(i,i.length-1)/a),u=i[i.length-1],l=O.sizeFromDimension(r,u),d=[{type:12,data:s},{type:12,data:u},{type:12,data:l},...K(e[1].dims,e[2].dims,n)],c=f=>{let g=N("indices",e[1].dataType,e[1].dims.length),_=N("updates",e[2].dataType,e[2].dims.length,a),y=t.reduction!=="none"&&t.reduction!==""?js("output",e[0].dataType,n.length):F("output",e[0].dataType,n.length,a);return`
      ${f.registerUniform("output_size","u32").registerUniform("last_index_dimension","u32").registerUniform("num_updates_elements","u32").declareVariables(g,_,y)}
      ${f.mainStart()}
        ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var data_offset = 0u;
  let indices_start = uniforms.last_index_dimension * global_idx;
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${e[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${Up(t.reduction,"output[data_offset + i]","value",y.type.value)}
  }

      }`};return{name:"ScatterND",shaderCache:{hint:`${t.cacheKey}_${t.reduction}`,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:n,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:d}),getShaderSource:c}},Lp=e=>he({reduction:e.reduction}),Wp=(e,t)=>{e.compute(qp(e.inputs,t),{inputs:[e.inputs[1],e.inputs[2]],outputs:[]})}}),Vp,Gp,Fp,Pn,Hp,jp,Kp,Zp,Xp,Qp,Yp,Jp,Un,ec,tc,rc,ic,nc,ac,sc,y0=U(()=>{te(),ie(),ke(),ne(),Vp=(e,t)=>{if(e.every(r=>r>0||(()=>{throw new Error("Resize requires scales input values to be positive")})),e.length>0){if(t.mode==="linear"){if(!(e.length===2||e.length===3||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1||e.length===5&&e[0]===1&&e[1]===1))throw new Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(t.mode==="cubic"&&!(e.length===2||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1))throw new Error("Resize requires scales input size to be 2 or 4 for cubic mode")}},Gp=(e,t,r)=>{t.every(n=>n>=0&&n<r||(()=>{throw new Error("Resize requires axes input values to be positive and less than rank")}));let i=new Array(r).fill(1);return t.forEach((n,a)=>i[n]=e[a]),i},Fp=(e,t,r,i,n,a)=>{let[s,u,l]=r>10?[1,2,3]:[-1,e.length>1?1:-1,-1],d=e[0].dims.length;if(s>0&&e.length>s&&e[s].dims.length>0)e[s].getFloat32Array().forEach(c=>a.push(c));else if(t.coordinateTransformMode==="tf_crop_and_resize")throw new Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");if(u>0&&e.length>u&&e[u].dims.length===1&&e[u].dims[0]>0){if(e[u].getFloat32Array().forEach(c=>i.push(c)),i.length!==0&&i.length!==d&&r>=18&&i.length!==t.axes.length)throw new Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");Vp(i,t),t.axes.length>0&&Gp(i,t.axes,d).forEach((c,f)=>i[f]=c)}if(l>0&&e.length>l&&e[l].dims.length===1&&e[l].dims[0]>0&&(e[l].getBigInt64Array().forEach(c=>n.push(Number(c))),n.length!==0&&n.length!==d&&r>=18&&n.length!==t.axes.length))throw new Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");if(t.axes.length>0){if(i.length!==0&&i.length!==t.axes.length)throw new Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');if(n.length!==0&&n.length!==t.axes.length)throw new Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified')}if(typeof i<"u"&&typeof n<"u"&&i.length>0&&n.length>d)throw new Error("Resize requires only of scales or sizes to be specified")},Pn=(e,t,r,i)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${e}) * (${t});
  let whole = ${i}(big / (${r}));
  let fract = ${i}(big % (${r})) / ${i}(${r});
  return whole + fract;
`,Hp=(e,t)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${t} { `+(()=>{switch(e){case"asymmetric":return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${t}(xResized) / ${t}(xScale);
          } else {
            ${Pn("xResized","lengthOriginal","lengthResized",t)}
          }
        `;case"pytorch_half_pixel":return`if (lengthResized > 1) {
                    return (${t}(xResized) + 0.5) / ${t}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case"tf_half_pixel_for_nn":return`return (${t}(xResized) + 0.5) / ${t}(xScale);`;case"align_corners":return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${Pn("xResized","lengthOriginal - 1","lengthResized - 1",t)}
                  }`;case"tf_crop_and_resize":return`if (lengthResized > 1) {
                    return ${t}(roiStart) * ${t}(lengthOriginal - 1) +
                        (${t}(xResized) * ${t}(roiEnd - roiStart) * ${t}(lengthOriginal - 1)) /
                        ${t}(lengthResized - 1);
                  } else {
                    return 0.5 * ${t}(roiStart + roiEnd) * ${t}(lengthOriginal - 1);
                  }`;case"half_pixel_symmetric":return`const outputWidth = ${t}xScale * ${t}(lengthResized);
                  const adjustment = ${t}(lengthResized) / outputWidth;
                  const center = ${t}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;case"half_pixel":return`return ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;default:throw new Error(`Coordinate transform mode ${e} is not supported`)}})()+"}",jp=(e,t,r)=>`fn getNearestPixelFromOriginal(xOriginal: ${r}, isDownSample: bool) -> ${r} {`+(()=>{switch(e){case"round_prefer_ceil":return"if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";case"floor":return"return floor(xOriginal);";case"ceil":return"return ceil(xOriginal);";case"round_prefer_floor":return"if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";default:if(t<11)return"if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";throw new Error(`Nearest mode ${e} is not supported`)}})()+"}",Kp=(e,t,r)=>{let i=new Array(r).fill(0).concat(new Array(r).fill(1)),n=e.length===0?i:e.slice();return t.length>0?(t.forEach((a,s)=>{i[a]=n[s],i[s+r]=n[t.length+s]}),i):n},Zp=(e,t,r,i)=>{let n=[];if(r.length>0)if(i.length>0){if(e.forEach(a=>n.push(a)),Math.max(...i)>e.length)throw new Error("axes is out of bound");i.forEach((a,s)=>n[a]=r[s])}else r.forEach(a=>n.push(a));else{if(t.length===0)throw new Error("Resize requires either scales or sizes.");n=e.map((a,s)=>Math.round(a*t[s]))}return n},Xp=(e,t,r)=>{let i=(()=>{switch(r.keepAspectRatioPolicy){case"not_larger":return r.axes.length>0?Math.min(...r.axes.map(a=>t[a]),Number.MAX_VALUE):Math.min(...t,Number.MAX_VALUE);case"not_smaller":return r.axes.length>0?Math.max(...r.axes.map(a=>t[a]),Number.MIN_VALUE):Math.max(...t,Number.MIN_VALUE);default:throw new Error(`Keep aspect ratio policy ${r.keepAspectRatioPolicy} is not supported`)}})();t.fill(1,0,t.length);let n=e.slice();return r.axes.length>0?(r.axes.forEach(a=>t[a]=i),r.axes.forEach(a=>n[a]=Math.round(e[a]*t[a]))):(t.fill(i,0,t.length),n.forEach((a,s)=>n[s]=Math.round(a*t[s]))),n},Qp=(e,t,r,i,n)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${e.type.indices}) -> array<${e.type.value}, ${r.length}> {
      var original_indices: array<${e.type.value}, ${r.length}>;
      for (var i:u32 = 0; i < ${r.length}; i++) {
        var output_index = ${e.indicesGet("output_indices","i")};
        var scale = ${j("uniforms.scales","i",i)};
        var roi_low = ${j("uniforms.roi","i",n)};
        var roi_hi = ${j("uniforms.roi",`i + ${t.length}`,n)};
        if (scale == 1.0) {
          original_indices[i] = ${e.type.value}(output_index);
        } else {
          var input_shape_i = ${j("uniforms.input_shape","i",t.length)};
          var output_shape_i = ${j("uniforms.output_shape","i",r.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,Yp=(e,t,r,i,n,a,s)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
      var input_indices: ${e.type.indices};
      for (var i:u32 = 0; i < ${i.length}; i++) {
        var output_index = ${t.indicesGet("output_indices","i")};
        var input_index: u32;
        var scale = ${j("uniforms.scales","i",n)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${j("uniforms.roi","i",a)};
          var roi_hi = ${j("uniforms.roi",`i + ${r.length}`,a)};
          var input_shape_i = ${j("uniforms.input_shape","i",r.length)};
          var output_shape_i = ${j("uniforms.output_shape","i",i.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${s} || (original_idx >= 0 && original_idx < ${t.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${t.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${e.indicesSet("input_indices","i","input_index")}
      }
      return input_indices;
    }`,Jp=(e,t)=>`
    fn checkInputIndices(input_indices: ${e.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${t.length}; i++) {
        var input_index = ${e.indicesGet("input_indices","i")};
        if (input_index < 0 || input_index >= ${j("uniforms.input_shape","i",t.length)}) {
          return false;
        }
      }
      return true;
    }`,Un=(e,t,r,i)=>e.rank>i?`
    ${e.indicesSet("input_indices",t,"channel")};
    ${e.indicesSet("input_indices",r,"batch")};
`:"",ec=(e,t,r,i,n)=>{let[a,s,u,l]=r.length===2?[-1,0,1,-1]:[0,2,3,1],d=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${d} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",s,`max(0, min(row, ${r[s]} - 1))`)};
      ${e.indicesSet("input_indices",u,`max(0, min(col, ${r[u]} - 1))`)};
      ${Un(e,l,a,2)}
      return ${e.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${t.type.indices}) -> ${d} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${d} = originalIndices[${s}];
      var col:${d} = originalIndices[${u}];
      ${i?`if (row < 0 || row > (${r[s]} - 1) || col < 0 || col > (${r[u]} - 1)) {
        return ${n};
      }`:""};
      row = max(0, min(row, ${r[s]} - 1));
      col = max(0, min(col, ${r[u]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${r.length>2?`u32(originalIndices[${l}])`:"0"};
      var batch: u32 =  ${r.length>2?`u32(originalIndices[${a}])`:"0"};
      var x11: ${d} = getInputValue(batch, channel, row1, col1);
      var x12: ${d} = getInputValue(batch, channel, row1, col2);
      var x21: ${d} = getInputValue(batch, channel, row2, col1);
      var x22: ${d} = getInputValue(batch, channel, row2, col2);
      var dx1: ${d} = abs(row - ${d}(row1));
      var dx2: ${d} = abs(${d}(row2) - row);
      var dy1: ${d} = abs(col - ${d}(col1));
      var dy2: ${d} = abs(${d}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},tc=(e,t,r,i,n,a,s,u,l,d)=>{let c=r.length===2,[f,g]=c?[0,1]:[2,3],_=e.type.value,y=$=>{let S=$===f?"row":"col";return`
      fn ${S}CubicInterpolation(input_indices: ${e.type.indices}, output_indices: ${t.type.indices}) -> ${_} {
        var output_index = ${t.indicesGet("output_indices",$)};
        var originalIdx: ${_} = getOriginalCoordinateFromResizedCoordinate(output_index, ${n[$]},
        ${i[$]}, ${r[$]}, ${a[$]}, ${a[$]} + ${r.length});
        var fractOriginalIdx: ${_} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${u} && (originalIdx < 0 || originalIdx > (${r[$]} - 1))) {
          return ${l};
        }
        var data: array<${_}, 4> = array<${_}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${S}: ${_} = originalIdx + ${_}(i);
          if (${S} < 0 || ${S} >= ${r[$]}) {
            ${d?`coefs[i + 1] = 0.0;
                        continue;`:u?`return ${l};`:`${S} = max(0, min(${S}, ${r[$]} - 1));`};
          }
        var input_indices_copy: ${e.type.indices} = input_indices;
          ${e.indicesSet("input_indices_copy",$,`u32(${S})`)};
          data[i + 1] = ${$===f?e.getByIndices("input_indices_copy"):"rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${y(f)};
    ${y(g)};
  fn getCubicInterpolationCoefs(s: ${_}) -> array<${_}, 4> {
    var absS = abs(s);
    var coeffs: array<${_}, 4> = array<${_}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${_} = 1.0 - absS;
    var twoMinusAbsS: ${_} = 2.0 - absS;
    var onePlusAbsS: ${_} = 1.0 + absS;
    coeffs[0] = ((${s} * onePlusAbsS - 5 * ${s}) * onePlusAbsS + 8 * ${s}) * onePlusAbsS - 4 * ${s};
    coeffs[1] = ((${s} + 2) * absS - (${s} + 3)) * absS * absS + 1;
    coeffs[2] = ((${s} + 2) * oneMinusAbsS - (${s} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${s} * twoMinusAbsS - 5 * ${s}) * twoMinusAbsS + 8 * ${s}) * twoMinusAbsS - 4 * ${s};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${_}, 4>, coefs: array<${_}, 4>) -> ${_} {
    var coefsSum: ${_} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${t.type.indices}) -> ${_} {
    var input_indices: ${e.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},rc=(e,t,r,i,n)=>{let[a,s,u,l,d]=r.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],c=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${c} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",s,`max(0, min(depth, ${r[s]} - 1))`)};
      ${e.indicesSet("input_indices",u,`max(0, min(height, ${r[u]} - 1))`)};
      ${e.indicesSet("input_indices",l,`max(0, min(width, ${r[l]} - 1))`)};
      ${Un(e,d,a,3)}
      return ${e.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${t.type.indices}) -> ${c} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${c} = originalIndices[${s}];
      var height:${c} = originalIndices[${u}];
      var width:${c} = originalIndices[${l}];
      ${i?`if (depth < 0 || depth > (${r[s]} - 1) || height < 0 || height > (${r[u]} - 1) || width < 0 || (width > ${r[l]} - 1)) {
      return ${n};
        }`:""};

    depth = max(0, min(depth, ${r[s]} - 1));
      height = max(0, min(height, ${r[u]} - 1));
      width = max(0, min(width, ${r[l]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${r.length>3?`u32(originalIndices[${d}])`:"0"};
      var batch: u32 =  ${r.length>3?`u32(originalIndices[${a}])`:"0"};

      var x111: ${c} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${c} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${c} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${c} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${c} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${c} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${c} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${c} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${c} = abs(depth - ${c}(depth1));
      var dx2: ${c} = abs(${c}(depth2) - depth);
      var dy1: ${c} = abs(height - ${c}(height1));
      var dy2: ${c} = abs(${c}(height2) - height);
      var dz1: ${c} = abs(width - ${c}(width1));
      var dz2: ${c} = abs(${c}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},ic=(e,t,r,i,n,a)=>{let s=e.dims,u=Kp(a,t.axes,s.length),l=Zp(s,i,n,t.axes),d=i.slice();i.length===0&&(d=s.map((b,z)=>b===0?1:l[z]/b),t.keepAspectRatioPolicy!=="stretch"&&(l=Xp(s,d,t)));let c=F("output",e.dataType,l.length),f=N("input",e.dataType,s.length),g=O.size(l),_=s.length===l.length&&s.every((b,z)=>b===l[z]),y=t.coordinateTransformMode==="tf_crop_and_resize",$=t.extrapolationValue,S=f.type.value,x=b=>`
      ${_?"":`
      ${Hp(t.coordinateTransformMode,S)};
      ${(()=>{switch(t.mode){case"nearest":return`
              ${Jp(f,s)};
              ${jp(t.nearestMode,r,S)};
              ${Yp(f,c,s,l,d.length,u.length,y)};
              `;case"linear":return`
              ${Qp(c,s,l,d.length,u.length)};
              ${(()=>{if(s.length===2||s.length===4)return`${ec(f,c,s,y,$)}`;if(s.length===3||s.length===5)return`${rc(f,c,s,y,$)}`;throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.")})()};
            `;case"cubic":return`
            ${(()=>{if(s.length===2||s.length===4)return`${tc(f,c,s,l,d,u,t.cubicCoeffA,y,t.extrapolationValue,t.excludeOutside)}`;throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.")})()};
            `;default:throw Error("Invalid resize mode")}})()};
      `}
      ${b.registerUniform("output_size","u32").registerUniform("scales","f32",d.length).registerUniform("roi","f32",u.length).declareVariables(f,c)}
      ${b.mainStart()}
        ${b.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${_?"output[global_idx] = input[global_idx];":`
        let output_indices = ${c.offsetToIndices("global_idx")};
        var input_indices: ${f.type.indices};
        ${(()=>{switch(t.mode){case"nearest":return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${f.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${t.extrapolationValue};
                }`;case"linear":return`output[global_idx] = ${s.length===2||s.length===4?"bilinearInterpolation":"trilinearInterpolation"}(output_indices);`;case"cubic":return"output[global_idx] = bicubicInterpolation(output_indices);";default:throw Error(`Unsupported resize mode: ${t.mode}`)}})()};
`}
      }`;return{name:"Resize",shaderCache:{hint:`${t.cacheKey}|${r}|${d.length>0?t.mode==="cubic"?d:d.length:""}|${n.length>0?n:""}|${u.length>0?u:""}|${_}|${t.mode==="nearest"?s.length:s}`,inputDependencies:["rank"]},getShaderSource:x,getRunData:()=>({outputs:[{dims:l,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(g/64)},programUniforms:[{type:12,data:g},{type:1,data:d},{type:1,data:u},...K(s,l)]})}},nc=e=>{let t=e.customDataBuffer;return new Uint32Array(t.buffer,t.byteOffset,1)[0]},ac=(e,t)=>{let r=[],i=[],n=[],a=nc(e);if(t.antialias!==0)throw Error("Only default value (0) for Antialias attribute is supported");Fp(e.inputs,t,a,r,i,n),e.compute(ic(e.inputs[0],t,a,r,i,n),{inputs:[0]})},sc=e=>{let t=e.antialias,r=e.axes,i=e.coordinateTransformMode,n=e.cubicCoeffA,a=e.excludeOutside!==0,s=e.extrapolationValue,u=e.keepAspectRatioPolicy,l=e.mode,d=e.nearestMode===""?"simple":e.nearestMode;return he({antialias:t,axes:r,coordinateTransformMode:i,cubicCoeffA:n,excludeOutside:a,extrapolationValue:s,keepAspectRatioPolicy:u,mode:l,nearestMode:d})}}),oc,uc,lc,b0=U(()=>{te(),ie(),ne(),oc=e=>{if(!e||e.length<3)throw new Error("layerNorm requires at least 3 inputs.");let t=e[0],r=e[1],i=e[2];if(t.dataType!==r.dataType||t.dataType!==i.dataType)throw new Error("All inputs must have the same data type");if(t.dims.length!==3&&t.dims.length!==2)throw new Error("Input must be 2D or 3D");if(r.dims.length!==3&&r.dims.length!==2)throw new Error("Skip must be 2D or 3D");let n=t.dims[t.dims.length-1],a=t.dims[t.dims.length-2];if(r.dims[r.dims.length-1]!==n)throw new Error("Skip must have the same hidden size as input");if(r.dims[r.dims.length-2]!==a)throw new Error("Skip must have the same sequence length as input");if(i.dims.length!==1)throw new Error("Gamma must be 1D");if(i.dims[i.dims.length-1]!==n)throw new Error("Gamma must have the same hidden size as input");if(e.length>3){let s=e[3];if(s.dims.length!==1)throw new Error("Beta must be 1D");if(s.dims[s.dims.length-1]!==n)throw new Error("Beta must have the same hidden size as input")}if(e.length>4){let s=e[4];if(s.dims.length!==1)throw new Error("Bias must be 1D");if(s.dims[s.dims.length-1]!==n)throw new Error("Bias must have the same hidden size as input")}},uc=(e,t,r,i)=>{let n=t.simplified,a=e[0].dims,s=O.size(a),u=a,l=s,d=a.slice(-1)[0],c=i?a.slice(0,-1).concat(1):[],f=!n&&e.length>3,g=e.length>4,_=i&&r>1,y=i&&r>2,$=r>3,S=64,x=xe(d),b=[{type:12,data:l},{type:12,data:x},{type:12,data:d},{type:1,data:t.epsilon}],z=E=>{let A=[{name:"output_size",type:"u32"},{name:"components",type:"u32"},{name:"hidden_size",type:"u32"},{name:"epsilon",type:"f32"}],C=[N("x",e[0].dataType,e[0].dims,x),N("skip",e[1].dataType,e[1].dims,x),N("gamma",e[2].dataType,e[2].dims,x)];f&&C.push(N("beta",e[3].dataType,e[3].dims,x)),g&&C.push(N("bias",e[4].dataType,e[4].dims,x)),C.push(F("output",e[0].dataType,u,x)),_&&C.push(F("mean_output",1,c)),y&&C.push(F("inv_std_output",1,c)),$&&C.push(F("input_skip_bias_sum",e[0].dataType,u,x));let v=ze(e[0].dataType),D=ze(1,x);return`

      ${E.registerUniforms(A).declareVariables(...C)}
      var<workgroup> sum_shared : array<${D}, ${S}>;
      var<workgroup> sum_squared_shared : array<${D}, ${S}>;

      ${E.mainStart([S,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / ${S};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${S};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${S-1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${g?"bias[offset1d + i]":v+"(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${$?"input_skip_bias_sum[offset + i] = value;":""}
          output[offset + i] = value;
          let f32_value = ${Ht(v,x,"value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${S};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${ht("sum",x)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${ht("square_sum",x)} / f32(uniforms.hidden_size) ${n?"":"- mean * mean"} + uniforms.epsilon);
        ${_?"mean_output[global_idx] = mean;":""}
        ${y?"inv_std_output[global_idx] = inv_std_dev;":""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${n?"":`- ${v}(mean)`}) *
            ${v}(inv_std_dev) * gamma[offset1d + i]
            ${f?"+ beta[offset1d + i]":""};
        }
      }`},k=[{dims:u,dataType:e[0].dataType}];return r>1&&k.push({dims:c,dataType:1}),r>2&&k.push({dims:c,dataType:1}),r>3&&k.push({dims:a,dataType:e[0].dataType}),{name:"SkipLayerNormalization",shaderCache:{hint:`${x};${_};${y};${$}`,inputDependencies:e.map((E,A)=>"type")},getShaderSource:z,getRunData:()=>({outputs:k,dispatchGroup:{x:Math.ceil(l/d)},programUniforms:b})}},lc=(e,t)=>{oc(e.inputs);let r=[0];e.outputCount>1&&r.push(-3),e.outputCount>2&&r.push(-3),e.outputCount>3&&r.push(3),e.compute(uc(e.inputs,t,e.outputCount,!1),{outputs:r})}}),dc,hr,pc,qn,cc,hc,fc,mc,w0=U(()=>{te(),ie(),ke(),ne(),dc=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");if(t.axes.length!==0){if(t.axes.length!==t.starts.length||t.axes.length!==t.ends.length)throw new Error("axes, starts and ends must have the same length")}else if(t.starts.length!==t.ends.length)throw new Error("starts and ends must have the same length");e.slice(1).forEach((r,i)=>{if(e[i+1].dataType!==6&&e[i+1].dataType!==7)throw new Error(`Input ${i} must be an array of int32 or int64`)})},hr=(e,t)=>{let r=[];if(e.length>t)if(e[t].dataType===7)e[t].getBigInt64Array().forEach(i=>r.push(Number(i)));else if(e[t].dataType===6)e[t].getInt32Array().forEach(i=>r.push(Number(i)));else throw new Error(`Input ${t} must be an array of int32 or int64`);return r},pc=(e,t)=>{if(e.length>1){let r=hr(e,1),i=hr(e,2),n=hr(e,3);return n.length===0&&(n=[...Array(e[0].dims.length).keys()]),he({starts:r,ends:i,axes:n})}else return t},qn=(e,t,r,i,n)=>{let a=e;return e<0&&(a+=r[i[t]]),n[t]<0?Math.max(0,Math.min(a,r[i[t]]-1)):Math.max(0,Math.min(a,r[i[t]]))},cc=(e,t,r)=>`fn calculateInputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
          var input_indices: ${e.type.indices};
          var carry = 0u;
          for (var i = ${r.length-1}; i >= 0; i--) {
            let input_shape_i = ${j("uniforms.input_shape","i",r.length)};
            let steps_i = ${j("uniforms.steps","i",r.length)};
            let signs_i = ${j("uniforms.signs","i",r.length)};
            let starts_i = ${j("uniforms.starts","i",r.length)};
            var output_index = ${t.indicesGet("output_indices","i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${e.indicesSet("input_indices","i","input_index")};
          }
          return input_indices;
      }`,hc=(e,t)=>{let r=e[0].dims,i=O.size(r),n=t.axes.length>0?O.normalizeAxes(t.axes,r.length):[...Array(r.length).keys()],a=hr(e,4);a.forEach(x=>x!==0||(()=>{throw new Error("step cannot be 0")})),a.length===0&&(a=Array(n.length).fill(1));let s=t.starts.map((x,b)=>qn(x,b,r,n,a)),u=t.ends.map((x,b)=>qn(x,b,r,n,a));if(n.length!==s.length||n.length!==u.length)throw new Error("start, ends and axes should have the same number of elements");if(n.length!==r.length)for(let x=0;x<r.length;++x)n.includes(x)||(s.splice(x,0,0),u.splice(x,0,r[x]),a.splice(x,0,1));let l=a.map(x=>Math.sign(x));a.forEach((x,b,z)=>{if(x<0){let k=(u[b]-s[b])/x,E=s[b],A=E+k*a[b];s[b]=A,u[b]=E,z[b]=-x}});let d=r.slice(0);n.forEach((x,b)=>{d[x]=Math.ceil((u[x]-s[x])/a[x])});let c={dims:d,dataType:e[0].dataType},f=F("output",e[0].dataType,d.length),g=N("input",e[0].dataType,e[0].dims.length),_=O.size(d),y=[{name:"outputSize",type:"u32"},{name:"starts",type:"u32",length:s.length},{name:"signs",type:"i32",length:l.length},{name:"steps",type:"u32",length:a.length}],$=[{type:12,data:_},{type:12,data:s},{type:6,data:l},{type:12,data:a},...K(e[0].dims,d)],S=x=>`
      ${x.registerUniforms(y).declareVariables(g,f)}
        ${cc(g,f,r)}
        ${x.mainStart()}
          ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${f.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${f.setByOffset("global_idx",g.getByIndices("input_indices"))}
      }`;return{name:"Slice",shaderCache:{hint:`${l.length}_${s.length}_${a.length}`,inputDependencies:["rank"]},getShaderSource:S,getRunData:()=>({outputs:[c],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:$})}},fc=(e,t)=>{dc(e.inputs,t);let r=pc(e.inputs,t);e.compute(hc(e.inputs,r),{inputs:[0]})},mc=e=>{let t=e.starts,r=e.ends,i=e.axes;return he({starts:t,ends:r,axes:i})}}),gc,_c,yc,bc,$0=U(()=>{te(),ie(),ke(),ft(),ne(),gc=e=>{if(!e||e.length!==1)throw new Error("Softmax op requires 1 input.")},_c=(e,t)=>{let r=e.inputs[0],i=r.dims,n=O.size(i),a=i.length,s=O.normalizeAxis(t.axis,a),u=s<i.length-1,l,d=[];u?(d=Array.from({length:a},(C,v)=>v),d[s]=a-1,d[a-1]=s,l=e.compute(Pe(r,d),{inputs:[r],outputs:[-1]})[0]):l=r;let c=l.dims,f=c[a-1],g=n/f,_=xe(f),y=f/_,$=64;g===1&&($=256);let S=(C,v)=>v===4?`max(max(${C}.x, ${C}.y), max(${C}.z, ${C}.w))`:v===2?`max(${C}.x, ${C}.y)`:v===3?`max(max(${C}.x, ${C}.y), ${C}.z)`:C,x=N("x",l.dataType,l.dims,_),b=F("result",l.dataType,l.dims,_),z=x.type.value,k=ze(l.dataType)==="f32"?`var threadMax = ${z}(-3.4028234663852886e+38f);`:`var threadMax = ${z}(-65504.0h);`,E=C=>`
      var<workgroup> rowMaxShared : ${z};
      var<workgroup> rowSumShared : ${z};
      var<workgroup> threadShared : array<${z}, ${$}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${z} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${z}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${C.registerUniform("packedCols","i32").declareVariables(x,b)}
      ${C.mainStart($)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${$};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${k}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${z}(${S("threadShared[0]",_)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${z}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${z}(${ht("threadShared[0]",_)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          var value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          // max operation protects against NaN since all values should be >=0
          value = max(value, ${z}(0.0));
          setValue(row, col, row_stride, value);
        }
      }`,A=e.compute({name:"Softmax",shaderCache:{hint:`${_};${$}`,inputDependencies:["type"]},getRunData:()=>({outputs:[{dims:c,dataType:l.dataType}],dispatchGroup:{x:g},programUniforms:[{type:6,data:y}]}),getShaderSource:E},{inputs:[l],outputs:[u?-1:0]})[0];u&&e.compute(Pe(A,d),{inputs:[A]})},yc=(e,t)=>{gc(e.inputs),_c(e,t)},bc=e=>he({axis:e.axis})}),Ln,wc,$c,vc,xc,v0=U(()=>{te(),ie(),ne(),Ln=e=>Array.from(e.getBigInt64Array(),Number),wc=e=>{if(!e||e.length!==2)throw new Error("Tile requires 2 inputs.");if(e[0].dataType!==1&&e[0].dataType!==10&&e[0].dataType!==6&&e[0].dataType!==12)throw new Error("Tile only support float, float16, int32, and uint32 data types");if(e[1].dataType!==7)throw new Error("Tile `repeats` input should be of int64 data type");if(e[1].dims.length!==1)throw new Error("Tile `repeats` input should be 1-D");if(Ln(e[1]).length!==e[0].dims.length)throw new Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},$c=(e,t)=>{let r=[];for(let i=0;i<e.length;++i)r.push(e[i]*t[i]);return r},vc=(e,t)=>{let r=e[0].dims,i=t??Ln(e[1]),n=$c(r,i),a=O.size(n),s=e[0].dataType,u=N("input",s,r.length),l=F("output",s,n.length),d=c=>`
      const inputShape = ${u.indices(...r)};
      ${c.registerUniform("output_size","u32").declareVariables(u,l)}
      ${c.mainStart()}
      ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${l.offsetToIndices("global_idx")};
      var input_indices: ${u.type.indices};
      for (var i = 0; i < ${r.length}; i++) {
        let input_dim_i = ${u.indicesGet("uniforms.input_shape","i")};
        let input_dim_value = ${l.indicesGet("output_indices","i")}  % input_dim_i;

        ${u.indicesSet("input_indices","i","input_dim_value")}
      }
      ${l.setByOffset("global_idx",u.getByIndices("input_indices"))}
    }`;return{name:"Tile",shaderCache:{hint:`${i}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:n,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:[{type:12,data:a},...K(e[0].dims,n)]}),getShaderSource:d}},xc=e=>{wc(e.inputs),e.compute(vc(e.inputs),{inputs:[0]})}}),kc,Sc,Tc,x0=U(()=>{te(),ie(),ne(),kc=(e,t,r,i,n)=>{let a=F("output_data",n,r.length,4),s=N("a_data",t[1].dataType,t[1].dims.length,4),u=N("b_data",t[2].dataType,t[2].dims.length,4),l=N("c_data",t[0].dataType,t[0].dims.length,4),d,c=(f,g,_)=>`select(${g}, ${f}, ${_})`;if(!i)d=a.setByOffset("global_idx",c(s.getByOffset("global_idx"),u.getByOffset("global_idx"),l.getByOffset("global_idx")));else{let f=(g,_,y="")=>{let $=`a_data[index_a${_}][component_a${_}]`,S=`b_data[index_b${_}][component_b${_}]`,x=`bool(c_data[index_c${_}] & (0xffu << (component_c${_} * 8)))`;return`
            let output_indices${_} = ${a.offsetToIndices(`global_idx * 4u + ${_}u`)};
            let offset_a${_} = ${s.broadcastedIndicesToOffset(`output_indices${_}`,a)};
            let offset_b${_} = ${u.broadcastedIndicesToOffset(`output_indices${_}`,a)};
            let offset_c${_} = ${l.broadcastedIndicesToOffset(`output_indices${_}`,a)};
            let index_a${_} = offset_a${_} / 4u;
            let index_b${_} = offset_b${_} / 4u;
            let index_c${_} = offset_c${_} / 4u;
            let component_a${_} = offset_a${_} % 4u;
            let component_b${_} = offset_b${_} % 4u;
            let component_c${_} = offset_c${_} % 4u;
            ${g}[${_}] = ${y}(${c($,S,x)});
          `};n===9?d=`
            var data = vec4<u32>(0);
            ${f("data",0,"u32")}
            ${f("data",1,"u32")}
            ${f("data",2,"u32")}
            ${f("data",3,"u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:d=`
            ${f("output_data[global_idx]",0)}
            ${f("output_data[global_idx]",1)}
            ${f("output_data[global_idx]",2)}
            ${f("output_data[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(l,s,u,a)}
        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${d}
      }`},Sc=e=>{let t=e[1].dims,r=e[2].dims,i=e[0].dims,n=e[1].dataType,a=!(O.areEqual(t,r)&&O.areEqual(r,i)),s=t,u=O.size(t);if(a){let d=Gt.calcShape(Gt.calcShape(t,r,!1),i,!1);if(!d)throw new Error("Can't perform where op on the given tensors");s=d,u=O.size(s)}let l=Math.ceil(u/4);return{name:"Where",shaderCache:{inputDependencies:["rank","rank","rank"]},getShaderSource:d=>kc(d,e,s,a,n),getRunData:()=>({outputs:[{dims:s,dataType:n}],dispatchGroup:{x:Math.ceil(u/64/4)},programUniforms:[{type:12,data:l},...K(i,t,r,s)]})}},Tc=e=>{e.compute(Sc(e.inputs))}}),zc,k0=U(()=>{P_(),rn(),U_(),q_(),L_(),W_(),V_(),K_(),X_(),Q_(),Y_(),J_(),e0(),t0(),r0(),i0(),n0(),a0(),s0(),o0(),u0(),l0(),d0(),p0(),c0(),Ud(),h0(),f0(),m0(),g0(),_0(),Ji(),y0(),Zd(),b0(),w0(),$0(),Hd(),v0(),ft(),on(),x0(),zc=new Map([["Abs",[ou]],["Acos",[uu]],["Acosh",[lu]],["Add",[Xu]],["ArgMax",[Ho,tn]],["ArgMin",[Fo,tn]],["Asin",[du]],["Asinh",[pu]],["Atan",[cu]],["Atanh",[hu]],["Attention",[Yo]],["AveragePool",[Sp,kp]],["BatchNormalization",[ru]],["BiasAdd",[au]],["BiasSplitGelu",[ju]],["Cast",[mu,fu]],["Ceil",[yu]],["Clip",[_u]],["Concat",[dl,pl]],["Conv",[wn,yn]],["ConvTranspose",[Pl,Nl]],["Cos",[bu]],["Cosh",[wu]],["CumSum",[ql,Ll]],["DepthToSpace",[Fl,Hl]],["DequantizeLinear",[Bp,Np]],["Div",[Qu]],["Einsum",[Yl,Jl]],["Elu",[$u,or]],["Equal",[Yu]],["Erf",[vu]],["Exp",[xu]],["Expand",[id]],["FastGelu",[ad]],["Floor",[ku]],["FusedConv",[wn,yn]],["Gather",[ld,ud]],["GatherElements",[wd,bd]],["GatherBlockQuantized",[md,gd]],["GatherND",[pd,cd]],["Gelu",[Su]],["Gemm",[kd,xd]],["GlobalAveragePool",[zp,Tp]],["GlobalMaxPool",[Ap,Cp]],["Greater",[rl]],["GreaterOrEqual",[nl]],["GridSample",[Rd,Bd]],["GroupQueryAttention",[Jd]],["HardSigmoid",[Ru,Ou]],["InstanceNormalization",[rp]],["LayerNormalization",[ap]],["LeakyRelu",[Tu,or]],["Less",[il]],["LessOrEqual",[al]],["Log",[Lu]],["MatMul",[op]],["MatMulNBits",[pp,cp]],["MaxPool",[Ep,Ip]],["Mul",[Ju]],["MultiHeadAttention",[Pd,Md]],["Neg",[Eu]],["Not",[zu]],["Pad",[$p]],["Pow",[el]],["QuickGelu",[Gu,or]],["Range",[Pp]],["Reciprocal",[Iu]],["ReduceMin",[qo]],["ReduceMean",[No]],["ReduceMax",[Uo]],["ReduceSum",[Wo]],["ReduceProd",[Lo]],["ReduceL1",[Mo]],["ReduceL2",[Do]],["ReduceLogSum",[Go]],["ReduceLogSumExp",[Po]],["ReduceSumSquare",[Vo]],["Relu",[Cu]],["Resize",[ac,sc]],["RotaryEmbedding",[Kd]],["ScatterND",[Wp,Lp]],["Sigmoid",[Au]],["Sin",[Bu]],["Sinh",[Nu]],["Slice",[fc,mc]],["SkipLayerNormalization",[lc]],["Split",[Gd,Fd]],["Sqrt",[Mu]],["Softmax",[yc,bc]],["Sub",[tl]],["Tan",[Du]],["Tanh",[Pu]],["ThresholdedRelu",[qu,or]],["Tile",[xc]],["Transpose",[to,ro]],["Where",[Tc]]])}),Ec,S0=U(()=>{Ue(),ot(),ne(),Ec=class{constructor(e){this.backend=e,this.repo=new Map,this.attributesBound=!1}getArtifact(e){return this.repo.get(e)}setArtifact(e,t){this.repo.set(e,t)}run(e,t,r,i,n){Je(e.programInfo.name);let a=this.backend.device,s=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let u=[];for(let d of t)u.push({binding:u.length,resource:{buffer:d.buffer}});for(let d of r)u.push({binding:u.length,resource:{buffer:d.buffer}});n&&u.push({binding:u.length,resource:n});let l=a.createBindGroup({layout:e.computePipeline.getBindGroupLayout(0),entries:u,label:e.programInfo.name});if(this.backend.sessionStatus==="capturing"){let d={kernelId:this.backend.currentKernelId,computePipeline:e.computePipeline,bindGroup:l,dispatchGroup:i};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(d)}s.setPipeline(e.computePipeline),s.setBindGroup(0,l),s.dispatchWorkgroups(...i),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType==="at-passes")&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),Ge(e.programInfo.name)}dispose(){}build(e,t){Je(e.name);let r=this.backend.device,i=[];[{feature:"shader-f16",extension:"f16"},{feature:"subgroups",extension:"subgroups"}].forEach(d=>{r.features.has(d.feature)&&i.push(`enable ${d.extension};`)});let n=Zs(t,this.backend.device.limits),a=e.getShaderSource(n),s=`${i.join(`
`)}
${n.additionalImplementations}
${a}`,u=r.createShaderModule({code:s,label:e.name});de("verbose",()=>`[WebGPU] ${e.name} shader code: ${s}`);let l=r.createComputePipeline({compute:{module:u,entryPoint:"main"},layout:"auto",label:e.name});return Ge(e.name),{programInfo:e,computePipeline:l,uniformVariablesInfo:n.variablesInfo}}normalizeDispatchGroupSize(e){let t=typeof e=="number"?e:e.x,r=typeof e=="number"?1:e.y||1,i=typeof e=="number"?1:e.z||1,n=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(t<=n&&r<=n&&i<=n)return[t,r,i];let a=t*r*i,s=Math.ceil(Math.sqrt(a));if(s>n){if(s=Math.ceil(Math.cbrt(a)),s>n)throw new Error("Total dispatch size exceeds WebGPU maximum.");return[s,s,s]}else return[s,s,1]}}}),Ic={};Wt(Ic,{WebGpuBackend:()=>Rc});var Cc,Ac,Oc,Rc,T0=U(()=>{Ue(),te(),ot(),Ns(),M_(),k0(),S0(),Cc=(e,t)=>{if(t.length!==e.length)throw new Error(`inputDependencies length ${t.length} is not equal to inputTensors length ${e.length}.`);let r=[];for(let i=0;i<e.length;++i){let n=e[i].dataType;switch(t[i]){case"none":{r.push("");break}case"type":{r.push(`${n}`);break}case"rank":{let a=e[i].dims.length;r.push(`${n};${a}`);break}case"dims":{let a=e[i].dims.join(",");r.push(`${n};${a}`);break}default:throw new Error(`unsupported input dependency: ${t[i]}`)}}return r.join("|")},Ac=(e,t,r)=>{let i=e.name;return e.shaderCache?.hint&&(i+="["+e.shaderCache.hint+"]"),i+=":"+r+`:${Cc(t,e.shaderCache?.inputDependencies??new Array(t.length).fill("dims"))}`,i},Oc=class{constructor(e){e&&(this.architecture=e.architecture,this.vendor=e.vendor)}isArchitecture(e){return this.architecture===e}isVendor(e){return this.vendor===e}},Rc=class{constructor(){this.currentSessionId=null,this.currentKernelId=null,this.commandEncoder=null,this.computePassEncoder=null,this.maxDispatchNumber=16,this.pendingDispatchNumber=0,this.pendingKernels=[],this.pendingQueries=new Map,this.sessionStatus="default",this.capturedCommandList=new Map,this.capturedPendingKernels=new Map,this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw new Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");let e=this.kernelCustomData.get(this.currentKernelId);return e||(e={},this.kernelCustomData.set(this.currentKernelId,e)),e}async initialize(e,t){this.env=e;let r=[],i={requiredLimits:{maxComputeWorkgroupStorageSize:t.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:t.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize,maxBufferSize:t.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:t.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:t.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:t.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:t.limits.maxComputeWorkgroupSizeZ},requiredFeatures:r},n=u=>t.features.has(u)&&r.push(u)&&!0;n("chromium-experimental-timestamp-query-inside-passes")||n("timestamp-query"),n("shader-f16"),n("subgroups"),this.device=await t.requestDevice(i);let a=t,s=t.info??(typeof a.requestAdapterInfo=="function"?await a.requestAdapterInfo():void 0);this.adapterInfo=new Oc(s),this.gpuDataManager=Fs(this),this.programManager=new Ec(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,Mi(e.logLevel,!!e.debug),this.device.onuncapturederror=u=>{u.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${u.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!0}),Object.defineProperty(this.env.webgpu,"adapter",{value:t,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){typeof this.querySet<"u"&&this.querySet.destroy(),this.gpuDataManager.dispose(),this.device&&this.env?.webgpu&&this.device.lost.then(()=>{delete this.env.webgpu.device})}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let e=this.getCommandEncoder(),t={};this.queryType==="at-passes"&&(t.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=e.beginComputePass(t)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;Je(),this.endComputePass();let e;this.queryType!=="none"&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),e=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(e,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,e,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!=="none"&&e.mapAsync(GPUMapMode.READ).then(()=>{let t=new BigUint64Array(e.getMappedRange()),r=this.pendingQueries.get(e);for(let i=0;i<t.length/2;i++){let n=r[i],a=n.kernelId,s=this.kernels.get(a),u=s.kernelType,l=s.kernelName,d=n.programName,c=n.inputTensorViews,f=n.outputTensorViews,g=t[i*2],_=t[i*2+1];typeof this.queryTimeBase>"u"&&(this.queryTimeBase=g);let y=Number(g-this.queryTimeBase),$=Number(_-this.queryTimeBase);if(!Number.isSafeInteger(y)||!Number.isSafeInteger($))throw new RangeError("incorrect timestamp range");if(this.env.webgpu.profiling?.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:c.map(S=>({dims:S.dims,dataType:st(S.dataType)})),outputsMetadata:f.map(S=>({dims:S.dims,dataType:st(S.dataType)})),kernelId:a,kernelType:u,kernelName:l,programName:d,startTime:y,endTime:$});else{let S="";c.forEach((b,z)=>{S+=`input[${z}]: [${b.dims}] | ${st(b.dataType)}, `});let x="";f.forEach((b,z)=>{x+=`output[${z}]: [${b.dims}] | ${st(b.dataType)}, `}),console.log(`[profiling] kernel "${a}|${u}|${l}|${d}" ${S}${x}start time: ${y} ns, execution time: ${$-y} ns`)}zr("GPU",`${d}::${g}::${_}`)}e.unmap(),this.pendingQueries.delete(e)}),Ge()}run(e,t,r,i,n,a){Je(e.name);let s=[];for(let b=0;b<t.length;++b){let z=t[b].data;if(z===0)continue;let k=this.gpuDataManager.get(z);if(!k)throw new Error(`no GPU data for input: ${z}`);s.push(k)}let{outputs:u,dispatchGroup:l,programUniforms:d}=e.getRunData(t),c=r.length===0?u.map((b,z)=>z):r;if(c.length!==u.length)throw new Error(`Output size ${c.length} must be equal to ${u.length}.`);let f=[],g=[];for(let b=0;b<u.length;++b){if(!Number.isInteger(c[b])||c[b]<-3||c[b]>=a)throw new Error(`Invalid output index: ${c[b]}`);if(c[b]===-3)continue;let z=c[b]===-1,k=c[b]===-2,E=z||k?n(u[b].dataType,u[b].dims):i(c[b],u[b].dataType,u[b].dims);if(f.push(E),E.data===0)continue;let A=this.gpuDataManager.get(E.data);if(!A)throw new Error(`no GPU data for output: ${E.data}`);if(z&&this.temporaryData.push(A),k){let C=this.kernelPersistentData.get(this.currentKernelId);C||(C=[],this.kernelPersistentData.set(this.currentKernelId,C)),C.push(A)}g.push(A)}if(s.length!==t.length||g.length!==f.length){if(g.length===0)return Ge(e.name),f;throw new Error(`Program ${e.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let _;if(d){let b=0,z=[];d.forEach(C=>{let v=typeof C.data=="number"?[C.data]:C.data;if(v.length===0)return;let D=C.type===10?2:4,q,Q;C.type===10?(Q=v.length>4?16:v.length>2?8:v.length*D,q=v.length>4?16:D*v.length):(Q=v.length<=2?v.length*D:16,q=16),b=Math.ceil(b/Q)*Q,z.push(b);let H=C.type===10?8:4;b+=v.length>4?Math.ceil(v.length/H)*q:v.length*D});let k=16;b=Math.ceil(b/k)*k;let E=new ArrayBuffer(b);d.forEach((C,v)=>{let D=z[v],q=typeof C.data=="number"?[C.data]:C.data;if(C.type===6)new Int32Array(E,D,q.length).set(q);else if(C.type===12)new Uint32Array(E,D,q.length).set(q);else if(C.type===10)new Uint16Array(E,D,q.length).set(q);else if(C.type===1)new Float32Array(E,D,q.length).set(q);else throw new Error(`Unsupported uniform type: ${st(C.type)}`)});let A=this.gpuDataManager.create(b,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(A.buffer,0,E,0,b),this.gpuDataManager.release(A.id),_={offset:0,size:b,buffer:A.buffer}}let y=this.programManager.normalizeDispatchGroupSize(l),$=y[1]===1&&y[2]===1,S=Ac(e,t,$),x=this.programManager.getArtifact(S);if(x||(x=this.programManager.build(e,y),this.programManager.setArtifact(S,x),de("info",()=>`[artifact] key: ${S}, programName: ${e.name}`)),d&&x.uniformVariablesInfo){if(d.length!==x.uniformVariablesInfo.length)throw new Error(`Uniform variables count mismatch: expect ${x.uniformVariablesInfo.length}, got ${d.length} in program "${x.programInfo.name}".`);for(let b=0;b<d.length;b++){let z=d[b],k=z.type,E=typeof z.data=="number"?1:z.data.length,[A,C]=x.uniformVariablesInfo[b];if(k!==A||E!==C)throw new Error(`Uniform variable ${b} mismatch: expect type ${A} with size ${C}, got type ${k} with size ${E} in program "${x.programInfo.name}".`)}}if(de("info",()=>`[ProgramManager] run "${e.name}" (key=${S}) with ${y[0]}x${y[1]}x${y[2]}`),this.queryType!=="none"||this.sessionStatus==="capturing"){let b={kernelId:this.currentKernelId,programName:x.programInfo.name,inputTensorViews:t,outputTensorViews:f};this.pendingKernels.push(b),this.sessionStatus==="capturing"&&this.capturedPendingKernels.get(this.currentSessionId).push(b)}return this.programManager.run(x,s,g,y,_),Ge(e.name),f}upload(e,t){this.gpuDataManager.upload(e,t)}memcpy(e,t){this.gpuDataManager.memcpy(e,t)}async download(e,t){await this.gpuDataManager.download(e,t)}alloc(e){return this.gpuDataManager.create(e).id}free(e){return this.gpuDataManager.release(e)}createKernel(e,t,r,i){let n=zc.get(e);if(!n)throw new Error(`kernel not implemented: ${e}`);let a={kernelType:e,kernelName:i,kernelEntry:n[0],attributes:[n[1],r]};this.kernels.set(t,a)}releaseKernel(e){let t=this.kernelPersistentData.get(e);if(t){for(let r of t)this.gpuDataManager.release(r.id);this.kernelPersistentData.delete(e)}this.kernelCustomData.delete(e),this.kernels.delete(e)}computeKernel(e,t,r){let i=this.kernels.get(e);if(!i)throw new Error(`kernel not created: ${e}`);let n=i.kernelType,a=i.kernelName,s=i.kernelEntry,u=i.attributes;if(this.currentKernelId!==null)throw new Error(`kernel "[${n}] ${a}" is not allowed to be called recursively`);this.currentKernelId=e,u[0]&&(u[1]=u[0](u[1]),u[0]=void 0),de("info",()=>`[WebGPU] Start to run kernel "[${n}] ${a}"...`);let l=this.env.debug;this.temporaryData=[];try{return l&&this.device.pushErrorScope("validation"),s(t,u[1]),0}catch(d){return r.push(Promise.resolve(`[WebGPU] Kernel "[${n}] ${a}" failed. ${d}`)),1}finally{l&&r.push(this.device.popErrorScope().then(d=>d?`GPU validation error for kernel "[${n}] ${a}": ${d.message}`:null));for(let d of this.temporaryData)this.gpuDataManager.release(d.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(e,t,r,i){let n=this.sessionExternalDataMapping.get(e);n||(n=new Map,this.sessionExternalDataMapping.set(e,n));let a=n.get(t),s=this.gpuDataManager.registerExternalBuffer(r,i,a);return n.set(t,[s,r]),s}unregisterBuffers(e){let t=this.sessionExternalDataMapping.get(e);t&&(t.forEach(r=>this.gpuDataManager.unregisterExternalBuffer(r[0])),this.sessionExternalDataMapping.delete(e))}getBuffer(e){let t=this.gpuDataManager.get(e);if(!t)throw new Error(`no GPU data for buffer: ${e}`);return t.buffer}createDownloader(e,t,r){return async()=>{let i=await Ki(this,e,t);return Di(i.buffer,r)}}writeTimestamp(e){this.queryType==="inside-passes"&&this.computePassEncoder.writeTimestamp(this.querySet,e)}setQueryType(){this.queryType="none",(this.env.webgpu.profiling?.mode==="default"||(typeof this.env.trace>"u"?this.env.wasm.trace:this.env.trace))&&(this.device.features.has("chromium-experimental-timestamp-query-inside-passes")?this.queryType="inside-passes":this.device.features.has("timestamp-query")&&(this.queryType="at-passes"),this.queryType!=="none"&&typeof this.querySet>"u"&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){de("info","captureBegin"),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus="capturing"}captureEnd(){de("info","captureEnd"),this.flush(),this.sessionStatus="default"}replay(){de("info","replay"),this.sessionStatus="replaying";let e=this.capturedCommandList.get(this.currentSessionId),t=this.capturedPendingKernels.get(this.currentSessionId),r=e.length;this.pendingKernels=[];for(let i=0;i<r;i++){let n=this.getComputePassEncoder(),a=e[i];this.writeTimestamp(this.pendingDispatchNumber*2),n.setPipeline(a.computePipeline),n.setBindGroup(0,a.bindGroup),n.dispatchWorkgroups(...a.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!=="none"&&this.pendingKernels.push(t[i]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType==="at-passes")&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus="default"}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(e){this.unregisterBuffers(e),this.capturedCommandList.has(e)&&this.capturedCommandList.delete(e),this.capturedPendingKernels.has(e)&&this.capturedPendingKernels.delete(e),this.gpuDataManager.onReleaseSession(e)}onRunStart(e){this.currentSessionId=e,this.setQueryType()}}}),Bc={};Wt(Bc,{init:()=>Mc});var Fr,Nc,Mc,z0=U(()=>{te(),ot(),ie(),N_(),Fr=class Jf{constructor(t,r,i,n){this.module=t,this.dataType=r,this.data=i,this.dims=n}getFloat32Array(){if(this.dataType!==1)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,t)}getBigInt64Array(){if(this.dataType!==7)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,t)}getInt32Array(){if(this.dataType!==6)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,t)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw new Error("Invalid data type");let t=O.size(this.dims);return t===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,t)}reshape(t){if(O.size(t)!==O.size(this.dims))throw new Error("Invalid new shape");return new Jf(this.module,this.dataType,this.data,t)}},Nc=class{constructor(e,t,r){this.module=e,this.backend=t,this.customDataOffset=0,this.customDataSize=0,this.adapterInfo=t.adapterInfo;let i=e.PTR_SIZE,n=r/e.PTR_SIZE,a=i===4?"i32":"i64";this.opKernelContext=Number(e.getValue(i*n++,a));let s=Number(e.getValue(i*n++,a));this.outputCount=Number(e.getValue(i*n++,a)),this.customDataOffset=Number(e.getValue(i*n++,"*")),this.customDataSize=Number(e.getValue(i*n++,a));let u=[];for(let l=0;l<s;l++){let d=Number(e.getValue(i*n++,a)),c=Number(e.getValue(i*n++,"*")),f=Number(e.getValue(i*n++,a)),g=[];for(let _=0;_<f;_++)g.push(Number(e.getValue(i*n++,a)));u.push(new Fr(e,d,c,g))}this.inputs=u}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(e,t){let r=t?.inputs?.map(s=>typeof s=="number"?this.inputs[s]:s)??this.inputs,i=t?.outputs??[],n=(s,u,l)=>new Fr(this.module,u,this.output(s,l),l),a=(s,u)=>{let l=It(s,u);if(!l)throw new Error(`Unsupported data type: ${s}`);let d=l>0?this.backend.gpuDataManager.create(l).id:0;return new Fr(this.module,s,d,u)};return this.backend.run(e,r,i,n,a,this.outputCount)}output(e,t){let r=this.module.stackSave();try{let i=this.module.PTR_SIZE,n=i===4?"i32":"i64",a=this.module.stackAlloc((1+t.length)*i);this.module.setValue(a,t.length,n);for(let s=0;s<t.length;s++)this.module.setValue(a+i*(s+1),t[s],n);return this.module._JsepOutput(this.opKernelContext,e,a)}catch(i){throw new Error(`Failed to generate kernel's output[${e}] with dims [${t}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${i}`)}finally{this.module.stackRestore(r)}}},Mc=async(e,t,r,i)=>{let n=t.jsepInit;if(!n)throw new Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");if(e==="webgpu"){let a=(T0(),er(Ic)).WebGpuBackend,s=new a;await s.initialize(r,i),n("webgpu",[s,u=>s.alloc(Number(u)),u=>s.free(u),(u,l,d,c=!1)=>{if(c)de("verbose",()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(u)}, dst=${Number(l)}, size=${Number(d)}`),s.memcpy(Number(u),Number(l));else{de("verbose",()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(u)}, gpuDataId=${Number(l)}, size=${Number(d)}`);let f=t.HEAPU8.subarray(Number(u>>>0),Number(u>>>0)+Number(d));s.upload(Number(l),f)}},async(u,l,d)=>{de("verbose",()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${u}, dataOffset=${l}, size=${d}`),await s.download(Number(u),()=>t.HEAPU8.subarray(Number(l)>>>0,Number(l+d)>>>0))},(u,l,d)=>s.createKernel(u,Number(l),d,t.UTF8ToString(t._JsepGetNodeName(Number(l)))),u=>s.releaseKernel(u),(u,l,d,c)=>{de("verbose",()=>`[WebGPU] jsepRun: sessionHandle=${d}, kernel=${u}, contextDataOffset=${l}`);let f=new Nc(t,s,Number(l));return s.computeKernel(Number(u),f,c)},()=>s.captureBegin(),()=>s.captureEnd(),()=>s.replay()])}else{let a=new Ls(r);n("webnn",[a,()=>a.reserveTensorId(),s=>a.releaseTensorId(s),async(s,u,l,d,c)=>a.ensureTensor(s,u,l,d,c),(s,u)=>{a.uploadTensor(s,u)},async(s,u)=>a.downloadTensor(s,u),(s,u)=>a.registerMLContext(s,u),!!r.trace])}}}),Dc,Wn,Vn,mt,Pc,Gn,Hr,Fn,Hn,jn,Kn,Zn,Xn,Uc=U(()=>{Ue(),O_(),R_(),te(),Tt(),Ai(),Ss(),Dc=(e,t)=>{_e()._OrtInit(e,t)!==0&&fe("Can't initialize onnxruntime.")},Wn=async e=>{Dc(e.wasm.numThreads,Or(e.logLevel))},Vn=async(e,t)=>{_e().asyncInit?.();let r=e.webgpu.adapter;if(t==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");if(r){if(typeof r.limits!="object"||typeof r.features!="object"||typeof r.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let i=e.webgpu.powerPreference;if(i!==void 0&&i!=="low-power"&&i!=="high-performance")throw new Error(`Invalid powerPreference setting: "${i}"`);let n=e.webgpu.forceFallbackAdapter;if(n!==void 0&&typeof n!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${n}"`);if(r=await navigator.gpu.requestAdapter({powerPreference:i,forceFallbackAdapter:n}),!r)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}}if(t==="webnn"&&(typeof navigator>"u"||!navigator.ml))throw new Error("WebNN is not supported in current environment");{let i=(z0(),er(Bc)).init;t==="webgpu"&&await i("webgpu",_e(),e,r),t==="webnn"&&await i("webnn",_e(),e)}},mt=new Map,Pc=e=>{let t=_e(),r=t.stackSave();try{let i=t.PTR_SIZE,n=t.stackAlloc(2*i);t._OrtGetInputOutputCount(e,n,n+i)!==0&&fe("Can't get session input/output count.");let a=i===4?"i32":"i64";return[Number(t.getValue(n,a)),Number(t.getValue(n+i,a))]}finally{t.stackRestore(r)}},Gn=(e,t)=>{let r=_e(),i=r.stackSave(),n=0;try{let a=r.PTR_SIZE,s=r.stackAlloc(2*a);r._OrtGetInputOutputMetadata(e,t,s,s+a)!==0&&fe("Can't get session input/output metadata.");let u=Number(r.getValue(s,"*"));n=Number(r.getValue(s+a,"*"));let l=r.HEAP32[n/4];if(l===0)return[u,0];let d=r.HEAPU32[n/4+1],c=[];for(let f=0;f<d;f++){let g=Number(r.getValue(n+8+f*a,"*"));c.push(g!==0?r.UTF8ToString(g):Number(r.getValue(n+8+(f+d)*a,"*")))}return[u,l,c]}finally{r.stackRestore(i),n!==0&&r._OrtFree(n)}},Hr=e=>{let t=_e(),r=t._malloc(e.byteLength);if(r===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);return t.HEAPU8.set(e,r),[r,e.byteLength]},Fn=async(e,t)=>{let r,i,n=_e();Array.isArray(e)?[r,i]=e:e.buffer===n.HEAPU8.buffer?[r,i]=[e.byteOffset,e.byteLength]:[r,i]=Hr(e);let a=0,s=0,u=0,l=[],d=[],c=[];try{if([s,l]=await ks(t),t?.externalData&&n.mountExternalData){let k=[];for(let E of t.externalData){let A=typeof E=="string"?E:E.path;k.push(Ni(typeof E=="string"?E:E.data).then(C=>{n.mountExternalData(A,C)}))}await Promise.all(k)}for(let k of t?.executionProviders??[])if((typeof k=="string"?k:k.name)==="webnn"){if(n.shouldTransferToMLTensor=!1,typeof k!="string"){let E=k,A=E?.context,C=E?.gpuDevice,v=E?.deviceType,D=E?.powerPreference;A?n.currentContext=A:C?n.currentContext=await n.webnnCreateMLContext(C):n.currentContext=await n.webnnCreateMLContext({deviceType:v,powerPreference:D})}else n.currentContext=await n.webnnCreateMLContext();break}a=await n._OrtCreateSession(r,i,s),n.webgpuOnCreateSession?.(a),a===0&&fe("Can't create a session."),n.jsepOnCreateSession?.(),n.currentContext&&(n.webnnRegisterMLContext(a,n.currentContext),n.currentContext=void 0,n.shouldTransferToMLTensor=!0);let[f,g]=Pc(a),_=!!t?.enableGraphCapture,y=[],$=[],S=[],x=[],b=[];for(let k=0;k<f;k++){let[E,A,C]=Gn(a,k);E===0&&fe("Can't get an input name."),d.push(E);let v=n.UTF8ToString(E);y.push(v),S.push(A===0?{name:v,isTensor:!1}:{name:v,isTensor:!0,type:st(A),shape:C})}for(let k=0;k<g;k++){let[E,A,C]=Gn(a,k+f);E===0&&fe("Can't get an output name."),c.push(E);let v=n.UTF8ToString(E);$.push(v),x.push(A===0?{name:v,isTensor:!1}:{name:v,isTensor:!0,type:st(A),shape:C});{if(_&&t?.preferredOutputLocation===void 0){b.push("gpu-buffer");continue}let D=typeof t?.preferredOutputLocation=="string"?t.preferredOutputLocation:t?.preferredOutputLocation?.[v]??"cpu",q=n.webnnIsGraphOutput;if(D==="cpu"&&q&&q(a,v)){b.push("ml-tensor-cpu-output");continue}if(D!=="cpu"&&D!=="cpu-pinned"&&D!=="gpu-buffer"&&D!=="ml-tensor")throw new Error(`Not supported preferred output location: ${D}.`);if(_&&D!=="gpu-buffer")throw new Error(`Not supported preferred output location: ${D}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);b.push(D)}}let z=null;return b.some(k=>k==="gpu-buffer"||k==="ml-tensor"||k==="ml-tensor-cpu-output")&&(u=n._OrtCreateBinding(a),u===0&&fe("Can't create IO binding."),z={handle:u,outputPreferredLocations:b,outputPreferredLocationsEncoded:b.map(k=>k==="ml-tensor-cpu-output"?"ml-tensor":k).map(k=>Bi(k))}),mt.set(a,[a,d,c,z,_,!1]),[a,y,$,S,x]}catch(f){throw d.forEach(g=>n._OrtFree(g)),c.forEach(g=>n._OrtFree(g)),u!==0&&n._OrtReleaseBinding(u)!==0&&fe("Can't release IO binding."),a!==0&&n._OrtReleaseSession(a)!==0&&fe("Can't release session."),f}finally{n._free(r),s!==0&&n._OrtReleaseSessionOptions(s)!==0&&fe("Can't release session options."),l.forEach(f=>n._free(f)),n.unmountExternalData?.()}},Hn=e=>{let t=_e(),r=mt.get(e);if(!r)throw new Error(`cannot release session. invalid session id: ${e}`);let[i,n,a,s,u]=r;s&&(u&&t._OrtClearBoundOutputs(s.handle)!==0&&fe("Can't clear bound outputs."),t._OrtReleaseBinding(s.handle)!==0&&fe("Can't release IO binding.")),t.jsepOnReleaseSession?.(e),t.webnnOnReleaseSession?.(e),t.webgpuOnReleaseSession?.(e),n.forEach(l=>t._OrtFree(l)),a.forEach(l=>t._OrtFree(l)),t._OrtReleaseSession(i)!==0&&fe("Can't release session."),mt.delete(e)},jn=async(e,t,r,i,n,a,s=!1)=>{if(!e){t.push(0);return}let u=_e(),l=u.PTR_SIZE,d=e[0],c=e[1],f=e[3],g=f,_,y;if(d==="string"&&(f==="gpu-buffer"||f==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(s&&f!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${a} when enableGraphCapture is true.`);if(f==="gpu-buffer"){let x=e[2].gpuBuffer;y=It(Et(d),c);{let b=u.jsepRegisterBuffer;if(!b)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');_=b(i,a,x,y)}}else if(f==="ml-tensor"){let x=e[2].mlTensor;y=It(Et(d),c);let b=u.webnnRegisterMLTensor;if(!b)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');_=b(i,x,Et(d),c)}else{let x=e[2];if(Array.isArray(x)){y=l*x.length,_=u._malloc(y),r.push(_);for(let b=0;b<x.length;b++){if(typeof x[b]!="string")throw new TypeError(`tensor data at index ${b} is not a string`);u.setValue(_+b*l,Fe(x[b],r),"*")}}else{let b=u.webnnIsGraphInput,z=u.webnnIsGraphOutput;if(d!=="string"&&b&&z){let k=u.UTF8ToString(n);if(b(i,k)||z(i,k)){let E=Et(d);y=It(E,c),g="ml-tensor";let A=u.webnnCreateTemporaryTensor,C=u.webnnUploadTensor;if(!A||!C)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');let v=await A(i,E,c);C(v,new Uint8Array(x.buffer,x.byteOffset,x.byteLength)),_=v}else y=x.byteLength,_=u._malloc(y),r.push(_),u.HEAPU8.set(new Uint8Array(x.buffer,x.byteOffset,y),_)}else y=x.byteLength,_=u._malloc(y),r.push(_),u.HEAPU8.set(new Uint8Array(x.buffer,x.byteOffset,y),_)}}let $=u.stackSave(),S=u.stackAlloc(4*c.length);try{c.forEach((b,z)=>u.setValue(S+z*l,b,l===4?"i32":"i64"));let x=u._OrtCreateTensor(Et(d),_,y,S,c.length,Bi(g));x===0&&fe(`Can't create tensor for input/output. session=${i}, index=${a}.`),t.push(x)}finally{u.stackRestore($)}},Kn=async(e,t,r,i,n,a)=>{let s=_e(),u=s.PTR_SIZE,l=mt.get(e);if(!l)throw new Error(`cannot run inference. invalid session id: ${e}`);let d=l[0],c=l[1],f=l[2],g=l[3],_=l[4],y=l[5],$=t.length,S=i.length,x=0,b=[],z=[],k=[],E=[],A=[],C=s.stackSave(),v=s.stackAlloc($*u),D=s.stackAlloc($*u),q=s.stackAlloc(S*u),Q=s.stackAlloc(S*u);try{[x,b]=bs(a),kt("wasm prepareInputOutputTensor");for(let M=0;M<$;M++)await jn(r[M],z,E,e,c[t[M]],t[M],_);for(let M=0;M<S;M++)await jn(n[M],k,E,e,f[i[M]],$+i[M],_);St("wasm prepareInputOutputTensor");for(let M=0;M<$;M++)s.setValue(v+M*u,z[M],"*"),s.setValue(D+M*u,c[t[M]],"*");for(let M=0;M<S;M++)s.setValue(q+M*u,k[M],"*"),s.setValue(Q+M*u,f[i[M]],"*");if(g&&!y){let{handle:M,outputPreferredLocations:G,outputPreferredLocationsEncoded:J}=g;if(c.length!==$)throw new Error(`input count from feeds (${$}) is expected to be always equal to model's input count (${c.length}).`);kt("wasm bindInputsOutputs");for(let ee=0;ee<$;ee++){let re=t[ee];await s._OrtBindInput(M,c[re],z[ee])!==0&&fe(`Can't bind input[${ee}] for session=${e}.`)}for(let ee=0;ee<S;ee++){let re=i[ee];n[ee]?.[3]?(A.push(k[ee]),s._OrtBindOutput(M,f[re],k[ee],0)!==0&&fe(`Can't bind pre-allocated output[${ee}] for session=${e}.`)):s._OrtBindOutput(M,f[re],0,J[re])!==0&&fe(`Can't bind output[${ee}] to ${G[ee]} for session=${e}.`)}St("wasm bindInputsOutputs"),mt.set(e,[d,c,f,g,_,!0])}s.jsepOnRunStart?.(d),s.webnnOnRunStart?.(d);let H;g?H=await s._OrtRunWithBinding(d,g.handle,S,q,x):H=await s._OrtRun(d,D,v,$,Q,S,q,x),H!==0&&fe("failed to call OrtRun().");let Z=[],R=[];kt("wasm ProcessOutputTensor");for(let M=0;M<S;M++){let G=Number(s.getValue(q+M*u,"*"));if(G===k[M]||A.includes(k[M])){Z.push(n[M]),G!==k[M]&&s._OrtReleaseTensor(G)!==0&&fe("Can't release tensor.");continue}let J=s.stackSave(),ee=s.stackAlloc(4*u),re=!1,ae,P=0;try{s._OrtGetTensorData(G,ee,ee+u,ee+2*u,ee+3*u)!==0&&fe(`Can't access output tensor data on index ${M}.`);let Y=u===4?"i32":"i64",X=Number(s.getValue(ee,Y));P=s.getValue(ee+u,"*");let V=s.getValue(ee+u*2,"*"),Te=Number(s.getValue(ee+u*3,Y)),Ce=[];for(let me=0;me<Te;me++)Ce.push(Number(s.getValue(V+me*u,Y)));s._OrtFree(V)!==0&&fe("Can't free memory for tensor dims.");let $e=Ce.reduce((me,we)=>me*we,1);ae=st(X);let Ae=g?.outputPreferredLocations[i[M]];if(ae==="string"){if(Ae==="gpu-buffer"||Ae==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let me=[];for(let we=0;we<$e;we++){let Be=s.getValue(P+we*u,"*"),Xr=s.getValue(P+(we+1)*u,"*"),tt=we===$e-1?void 0:Xr-Be;me.push(s.UTF8ToString(Be,tt))}Z.push([ae,Ce,me,"cpu"])}else if(Ae==="gpu-buffer"&&$e>0){let me=s.jsepGetBuffer;if(!me)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let we=me(P),Be=It(X,$e);if(Be===void 0||!Oi(ae))throw new Error(`Unsupported data type: ${ae}`);re=!0,Z.push([ae,Ce,{gpuBuffer:we,download:s.jsepCreateDownloader(we,Be,ae),dispose:()=>{s._OrtReleaseTensor(G)!==0&&fe("Can't release tensor.")}},"gpu-buffer"])}else if(Ae==="ml-tensor"&&$e>0){let me=s.webnnEnsureTensor,we=s.webnnIsGraphInputOutputTypeSupported;if(!me||!we)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(It(X,$e)===void 0||!Ri(ae))throw new Error(`Unsupported data type: ${ae}`);if(!we(e,ae,!1))throw new Error(`preferredLocation "ml-tensor" for ${ae} output is not supported by current WebNN Context.`);let Be=await me(e,P,X,Ce,!1);re=!0,Z.push([ae,Ce,{mlTensor:Be,download:s.webnnCreateMLTensorDownloader(P,ae),dispose:()=>{s.webnnReleaseTensorId(P),s._OrtReleaseTensor(G)}},"ml-tensor"])}else if(Ae==="ml-tensor-cpu-output"&&$e>0){let me=s.webnnCreateMLTensorDownloader(P,ae)(),we=Z.length;re=!0,R.push((async()=>{let Be=[we,await me];return s.webnnReleaseTensorId(P),s._OrtReleaseTensor(G),Be})()),Z.push([ae,Ce,[],"cpu"])}else{let me=Ar(ae),we=new me($e);new Uint8Array(we.buffer,we.byteOffset,we.byteLength).set(s.HEAPU8.subarray(P,P+we.byteLength)),Z.push([ae,Ce,we,"cpu"])}}finally{s.stackRestore(J),ae==="string"&&P&&s._free(P),re||s._OrtReleaseTensor(G)}}g&&!_&&(s._OrtClearBoundOutputs(g.handle)!==0&&fe("Can't clear bound outputs."),mt.set(e,[d,c,f,g,_,!1]));for(let[M,G]of await Promise.all(R))Z[M][2]=G;return St("wasm ProcessOutputTensor"),Z}finally{s.webnnOnRunEnd?.(d),s.stackRestore(C),z.forEach(H=>s._OrtReleaseTensor(H)),k.forEach(H=>s._OrtReleaseTensor(H)),E.forEach(H=>s._free(H)),x!==0&&s._OrtReleaseRunOptions(x),b.forEach(H=>s._free(H))}},Zn=e=>{let t=_e(),r=mt.get(e);if(!r)throw new Error("invalid session id");let i=r[0],n=t._OrtEndProfiling(i);n===0&&fe("Can't get an profile file name."),t._OrtFree(n)},Xn=e=>{let t=[];for(let r of e){let i=r[2];!Array.isArray(i)&&"buffer"in i&&t.push(i.buffer)}return t}}),gt,qe,jt,fr,mr,jr,Qn,Kr,Mt,Dt,qc,Lc,Wc,Vc,Gc,Fc,Hc,jc,Kc=U(()=>{Ue(),Uc(),Tt(),zi(),gt=()=>!!be.wasm.proxy&&typeof document<"u",jt=!1,fr=!1,mr=!1,Kr=new Map,Mt=(e,t)=>{let r=Kr.get(e);r?r.push(t):Kr.set(e,[t])},Dt=()=>{if(jt||!fr||mr||!qe)throw new Error("worker not ready")},qc=e=>{switch(e.data.type){case"init-wasm":jt=!1,e.data.err?(mr=!0,Qn[1](e.data.err)):(fr=!0,Qn[0]()),jr&&(URL.revokeObjectURL(jr),jr=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let t=Kr.get(e.data.type);e.data.err?t.shift()[1](e.data.err):t.shift()[0](e.data.out);break}}},Lc=async()=>{if(!fr){if(jt)throw new Error("multiple calls to 'initWasm()' detected.");if(mr)throw new Error("previous call to 'initWasm()' failed.");if(jt=!0,gt())return new Promise((e,t)=>{qe?.terminate(),fs().then(([r,i])=>{try{qe=i,qe.onerror=a=>t(a),qe.onmessage=qc,Qn=[e,t];let n={type:"init-wasm",in:be};!n.in.wasm.wasmPaths&&(r||xi)&&(n.in.wasm.wasmPaths={wasm:new URL("/assets/ort-wasm-simd-threaded.jsep-DC5y_g6C.wasm",self.location.href).href}),qe.postMessage(n),jr=r}catch(n){t(n)}},t)});try{await Ci(be.wasm),await Wn(be),fr=!0}catch(e){throw mr=!0,e}finally{jt=!1}}},Wc=async e=>{if(gt())return Dt(),new Promise((t,r)=>{Mt("init-ep",[t,r]);let i={type:"init-ep",in:{epName:e,env:be}};qe.postMessage(i)});await Vn(be,e)},Vc=async e=>gt()?(Dt(),new Promise((t,r)=>{Mt("copy-from",[t,r]);let i={type:"copy-from",in:{buffer:e}};qe.postMessage(i,[e.buffer])})):Hr(e),Gc=async(e,t)=>{if(gt()){if(t?.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return Dt(),new Promise((r,i)=>{Mt("create",[r,i]);let n={type:"create",in:{model:e,options:{...t}}},a=[];e instanceof Uint8Array&&a.push(e.buffer),qe.postMessage(n,a)})}else return Fn(e,t)},Fc=async e=>{if(gt())return Dt(),new Promise((t,r)=>{Mt("release",[t,r]);let i={type:"release",in:e};qe.postMessage(i)});Hn(e)},Hc=async(e,t,r,i,n,a)=>{if(gt()){if(r.some(s=>s[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(n.some(s=>s))throw new Error("pre-allocated output tensor is not supported for proxy.");return Dt(),new Promise((s,u)=>{Mt("run",[s,u]);let l=r,d={type:"run",in:{sessionId:e,inputIndices:t,inputs:l,outputIndices:i,options:a}};qe.postMessage(d,Xn(l))})}else return Kn(e,t,r,i,n,a)},jc=async e=>{if(gt())return Dt(),new Promise((t,r)=>{Mt("end-profiling",[t,r]);let i={type:"end-profiling",in:e};qe.postMessage(i)});Zn(e)}}),Yn,Zc,Xc,E0=U(()=>{Ue(),Kc(),te(),bi(),Ss(),Yn=(e,t)=>{switch(e.location){case"cpu":return[e.type,e.dims,e.data,"cpu"];case"gpu-buffer":return[e.type,e.dims,{gpuBuffer:e.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[e.type,e.dims,{mlTensor:e.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${e.location} for ${t()}`)}},Zc=e=>{switch(e[3]){case"cpu":return new Me(e[0],e[2],e[1]);case"gpu-buffer":{let t=e[0];if(!Oi(t))throw new Error(`not supported data type: ${t} for deserializing GPU tensor`);let{gpuBuffer:r,download:i,dispose:n}=e[2];return Me.fromGpuBuffer(r,{dataType:t,dims:e[1],download:i,dispose:n})}case"ml-tensor":{let t=e[0];if(!Ri(t))throw new Error(`not supported data type: ${t} for deserializing MLTensor tensor`);let{mlTensor:r,download:i,dispose:n}=e[2];return Me.fromMLTensor(r,{dataType:t,dims:e[1],download:i,dispose:n})}default:throw new Error(`invalid data location: ${e[3]}`)}},Xc=class{async fetchModelAndCopyToWasmMemory(e){return Vc(await Ni(e))}async loadModel(e,t){Je();let r;typeof e=="string"?r=await this.fetchModelAndCopyToWasmMemory(e):r=e,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await Gc(r,t),Ge()}async dispose(){return Fc(this.sessionId)}async run(e,t,r){Je();let i=[],n=[];Object.entries(e).forEach(f=>{let g=f[0],_=f[1],y=this.inputNames.indexOf(g);if(y===-1)throw new Error(`invalid input '${g}'`);i.push(_),n.push(y)});let a=[],s=[];Object.entries(t).forEach(f=>{let g=f[0],_=f[1],y=this.outputNames.indexOf(g);if(y===-1)throw new Error(`invalid output '${g}'`);a.push(_),s.push(y)});let u=i.map((f,g)=>Yn(f,()=>`input "${this.inputNames[n[g]]}"`)),l=a.map((f,g)=>f?Yn(f,()=>`output "${this.outputNames[s[g]]}"`):null),d=await Hc(this.sessionId,n,u,s,l,r),c={};for(let f=0;f<d.length;f++)c[this.outputNames[s[f]]]=a[f]??Zc(d[f]);return Ge(),c}startProfiling(){}endProfiling(){jc(this.sessionId)}}}),Qc={};Wt(Qc,{OnnxruntimeWebAssemblyBackend:()=>ea,initializeFlags:()=>Jn,wasmBackend:()=>Yc});var Jn,ea,Yc,I0=U(()=>{Ue(),Kc(),E0(),Jn=()=>{(typeof be.wasm.initTimeout!="number"||be.wasm.initTimeout<0)&&(be.wasm.initTimeout=0);let e=be.wasm.simd;if(typeof e!="boolean"&&e!==void 0&&e!=="fixed"&&e!=="relaxed"&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${e}". Reset it to \`false\` and ignore SIMD feature checking.`),be.wasm.simd=!1),typeof be.wasm.proxy!="boolean"&&(be.wasm.proxy=!1),typeof be.wasm.trace!="boolean"&&(be.wasm.trace=!1),typeof be.wasm.numThreads!="number"||!Number.isInteger(be.wasm.numThreads)||be.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)be.wasm.numThreads=1;else{let t=typeof navigator>"u"?f_("node:os").cpus().length:navigator.hardwareConcurrency;be.wasm.numThreads=Math.min(4,Math.ceil((t||1)/2))}},ea=class{async init(e){Jn(),await Lc(),await Wc(e)}async createInferenceSessionHandler(e,t){let r=new Xc;return await r.loadModel(e,t),r}},Yc=new ea});Ue(),Ue(),Ue();var C0="1.27.0";{let e=(I0(),er(Qc)).wasmBackend;Vt("webgpu",e,5),Vt("webnn",e,5),Vt("cpu",e,10),Vt("wasm",e,10)}Object.defineProperty(be.versions,"web",{value:C0,enumerable:!0});let Zr,Kt,lt=[],Pt,gr=!1;const A0=5e3,ta=8,O0=32;self.onmessage=e=>{const t=e.data;if(t.type==="cancel"){gr=!0;return}t.type==="index"&&R0(t),t.type==="search"&&B0(t)};async function R0(e){gr=!1;try{await P0();const t=e.chunks,r=new Map(lt.map(n=>[Zt(n),n.vector])),i=[];for(let n=0;n<t.length;n+=16){if(gr)throw new DOMException("Indexing cancelled","AbortError");const a=t.slice(n,n+16),s=a.filter(d=>!r.has(Zt(d))),u=s.length?await th(s.map(d=>`passage: ${d.text}`)):[],l=new Map(s.map((d,c)=>[Zt(d),u[c]]));i.push(...a.map(d=>({...d,vector:r.get(Zt(d))??l.get(Zt(d))}))),self.postMessage({type:"progress",completed:i.length,total:t.length})}lt=i,Pt=i.length>=A0?N0(i):void 0,await W0(i),self.postMessage({type:"indexed",count:i.length})}catch(t){self.postMessage({type:"error",message:t instanceof Error?t.message:String(t)})}}async function B0(e){gr=!1;try{if(!lt.length)throw new Error("Build the local semantic index first");const[t]=await th([`query: ${String(e.query??"")}`]),r=Math.min(50,Math.max(1,Number(e.limit??20))),n=(Pt?M0(t,Math.max(64,r*4)).map(a=>({chunk:lt[a.index],score:a.score})):lt.map(a=>({chunk:a,score:_t(t,a.vector)}))).map(({chunk:a,score:s})=>({fileId:a.fileId,path:a.path,heading:a.heading,text:a.text,offset:a.offset,score:s})).sort((a,s)=>s.score-a.score).slice(0,r);self.postMessage({type:"results",requestId:e.requestId,results:n})}catch(t){self.postMessage({type:"error",requestId:e.requestId,message:t instanceof Error?t.message:String(t)})}}function Zt(e){return`${e.fileId}\0${e.path}\0${e.offset}\0${e.text}`}function N0(e){const t=e.map((i,n)=>Array.from({length:D0(Zt(i))+1},()=>n===0?[]:[])),r={entryPoint:0,maximumLevel:t[0].length-1,levels:t};for(let i=1;i<e.length;i+=1){if(gr)throw new DOMException("Indexing cancelled","AbortError");const n=t[i].length-1;let a=r.entryPoint;for(let s=r.maximumLevel;s>n;s-=1)a=Jc(e[i].vector,a,s,r);for(let s=Math.min(n,r.maximumLevel);s>=0;s-=1){const u=eh(e[i].vector,[a],s,O0,r).slice(0,ta);t[i][s]=u.map(l=>l.index);for(const l of t[i][s]){const d=t[l][s]??(t[l][s]=[]);d.push(i),d.sort((c,f)=>_t(e[l].vector,e[f].vector)-_t(e[l].vector,e[c].vector)),d.length>ta&&(d.length=ta)}a=u[0]?.index??a}n>r.maximumLevel&&(r.entryPoint=i,r.maximumLevel=n)}return r}function M0(e,t){if(!Pt)return[];let r=Pt.entryPoint;for(let i=Pt.maximumLevel;i>0;i-=1)r=Jc(e,r,i,Pt);return eh(e,[r],0,t,Pt)}function Jc(e,t,r,i){let n=t,a=_t(e,lt[n].vector),s=!0;for(;s;){s=!1;for(const u of i.levels[n][r]??[]){const l=_t(e,lt[u].vector);l>a&&(n=u,a=l,s=!0)}}return n}function eh(e,t,r,i,n){const a=new Set(t),s=t.map(l=>({index:l,score:_t(e,lt[l].vector)})),u=[...s];for(;s.length;){s.sort((d,c)=>c.score-d.score);const l=s.shift();if(u.sort((d,c)=>c.score-d.score),u.length>=i&&l.score<u.at(-1).score)break;for(const d of n.levels[l.index][r]??[]){if(a.has(d))continue;a.add(d);const c={index:d,score:_t(e,lt[d].vector)};(u.length<i||c.score>u.at(-1).score)&&(s.push(c),u.push(c),u.sort((f,g)=>g.score-f.score),u.length>i&&(u.length=i))}}return u.sort((l,d)=>d.score-l.score)}function D0(e){let t=2166136261;for(let i=0;i<e.length;i+=1)t=Math.imul(t^e.charCodeAt(i),16777619)>>>0;let r=0;for(;(t&255)<94&&r<8;)r+=1,t=Math.imul(t^t>>>13,1540483477)>>>0;return r}async function P0(){if(Zr&&Kt)return;const e=await fetch("/models/multilingual-e5-small/manifest.json",{cache:"no-cache"});if(!e.ok)throw new Error("The first-party Deep Search model is unavailable");const t=await e.json();if(t.protocolVersion!==1||t.dimension!==384)throw new Error("Unsupported Deep Search model manifest");const r=new Map;for(const u of t.files){const l=await U0(u);r.set(u.name,l)}const i=r.get("tokenizer.json"),n=r.get("tokenizer_config.json"),a=r.get("model_quantized.onnx");if(!i||!n||!a)throw new Error("Deep Search model files are incomplete");Zr=new d_(JSON.parse(new TextDecoder().decode(i)),JSON.parse(new TextDecoder().decode(n)));const s="gpu"in navigator?["webgpu","wasm"]:["wasm"];Kt=await yi.create(a,{executionProviders:s})}async function U0(e){const i=await(await(await navigator.storage.getDirectory()).getDirectoryHandle("semantic-model-v1",{create:!0})).getFileHandle(e.name.replaceAll("/","_"),{create:!0}),n=new Uint8Array(await(await i.getFile()).arrayBuffer());if(n.length===e.byteSize&&await rh(n)===e.sha256)return n;const a=await fetch(e.url,{cache:"reload"});if(!a.ok)throw new Error(`Deep Search model download failed: ${e.name}`);const s=new Uint8Array(await a.arrayBuffer());if(s.length!==e.byteSize||await rh(s)!==e.sha256)throw new Error(`Deep Search model integrity check failed: ${e.name}`);const u=await i.createWritable();return await u.write(s.slice().buffer),await u.close(),s}async function th(e){if(!Zr||!Kt)throw new Error("Deep Search model is not loaded");const t=e.map(c=>{const f=Zr.encode(c);return f.ids.length<=512?f:{...f,ids:[...f.ids.slice(0,511),f.ids.at(-1)],attention_mask:[...f.attention_mask.slice(0,511),f.attention_mask.at(-1)]}}),r=Math.max(...t.map(c=>c.ids.length)),i=new BigInt64Array(e.length*r),n=new BigInt64Array(e.length*r);t.forEach((c,f)=>c.ids.forEach((g,_)=>{i[f*r+_]=BigInt(g),n[f*r+_]=1n}));const a={input_ids:new Me("int64",i,[e.length,r]),attention_mask:new Me("int64",n,[e.length,r])};Kt.inputNames.includes("token_type_ids")&&(a.token_type_ids=new Me("int64",new BigInt64Array(e.length*r),[e.length,r]));const s=await Kt.run(a),u=s.last_hidden_state??s[Kt.outputNames[0]],l=u.dims.at(-1)??384,d=u.data;return e.map((c,f)=>L0(q0(d,n,f,r,l)))}function q0(e,t,r,i,n){const a=new Float32Array(n);let s=0;for(let u=0;u<i;u+=1){if(t[r*i+u]===0n)continue;s+=1;const l=(r*i+u)*n;for(let d=0;d<n;d+=1)a[d]+=e[l+d]}for(let u=0;u<n;u+=1)a[u]/=Math.max(1,s);return a}function L0(e){const t=Math.sqrt(_t(e,e))||1;return e.map(r=>r/t)}function _t(e,t){let r=0;for(let i=0;i<e.length;i+=1)r+=e[i]*t[i];return r}async function W0(e){const i=await(await(await navigator.storage.getDirectory()).getDirectoryHandle("semantic-index-v1",{create:!0})).getFileHandle("vectors.f16",{create:!0}),n=new Uint16Array(e.length*384);e.forEach((s,u)=>s.vector.forEach((l,d)=>{n[u*384+d]=V0(l)}));const a=await i.createWritable();await a.write(n.buffer),await a.close()}function V0(e){const t=new DataView(new ArrayBuffer(4));t.setFloat32(0,e,!1);const r=t.getUint32(0,!1),i=r>>>16&32768,n=(r>>>23&255)-127+15,a=r>>>13&1023;return n<=0?i:n>=31?i|31744:i|n<<10|a}async function rh(e){return[...new Uint8Array(await crypto.subtle.digest("SHA-256",e.slice().buffer))].map(r=>r.toString(16).padStart(2,"0")).join("")}})();
