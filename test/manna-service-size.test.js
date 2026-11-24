const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("MANNA product wording includes exact shipping commitment without claiming checkout is open",()=>{
 const s=read("manna/goods/budao-gospel-fleece/index.html");
 assert.ok(!s.includes("展示图已按要求去除袖部足迹标识"));
 assert.ok(s.includes("3 日内发货"));
 assert.ok(s.includes("备货充足"));
 assert.ok(s.includes("经营主体"));
 assert.ok(s.includes("法定名称及营业执照信息核实后公示"));
 assert.ok(s.includes("购买通道暂未开放"));
 assert.ok(!s.includes("立即购买")&&!s.includes("支付成功"));
});
test("MANNA size guidance requires measuring an existing sweatshirt before ordering",()=>{
 const s=read("manna/goods/budao-gospel-fleece/index.html");
 const i=s.indexOf('class="manna-size-important"'),j=s.indexOf('class="manna-size-scroll"');
 assert.ok(i>=0&&j>i);
 const block=s.slice(i,j);
 for(const word of ["穿着合适的卫衣","平铺测量","衣长","半胸围","袖长","肩宽","不要只凭"]) assert.ok(block.includes(word),word);
 for(const x of ["65</td>","67</td>","69</td>","71</td>","73</td>","75</td>","100–115","175–200"])assert.ok(s.includes(x),x);
});
test("MANNA support entry does not pretend to be live before a real account is connected",()=>{
 const s=read("manna/goods/budao-gospel-fleece/index.html");
 const js=read("manna/assets/manna-support.js");
 assert.ok(s.includes('data-chat-property="" data-chat-widget=""'));
 assert.ok(s.includes('id="manna-support-toggle"'));
 assert.ok(s.includes("实时客服通道正在接入"));
 assert.ok(js.includes("https://embed.tawk.to/"));
 assert.ok(js.includes("if(!configured)return"));
 assert.ok(js.includes("script.onerror"));
 assert.ok(!js.includes("localStorage")&&!js.includes("fetch("));
 assert.ok(!s.includes("客服在线等候")&&!s.includes("马上回复"));
});
