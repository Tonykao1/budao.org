const test=require("node:test");
const assert=require("node:assert/strict");
const {SCHEMA_VERSION,validateForReview,publicProduct}=require("../manna/contracts/product-v1");
const valid=()=>({
 schemaVersion:SCHEMA_VERSION,id:"demo1",sku:"MANNA-001",name:"收纳织物",summary:"日常收纳。",
 category:"织物与收纳",specifications:{material:"示意材质"},
 images:[{assetKey:"products/example/01.webp",alt:"正面",primary:true,position:0,verified:true}],
 price:{currency:"CNY",amountMinor:12800},
 inventory:{mode:"in_stock",quantity:12},
 delivery:{origin:"示意发货地",coverage:"示意配送范围",dispatchEstimate:"3个工作日",
 shippingPolicy:"演示运费",shippingMinor:0},
 afterSales:{sellerLegalName:"仅做测试之用",policy:"演示退换货政策",contact:"演示联系渠道"},
 internal:{supplierEvidenceRef:"private://supplier-1",materialMinor:5400,laborMinor:2400,
 fulfillmentMinor:1800,afterSalesReserveMinor:800,bankAccount:"PRIVATE-NOT-PUBLIC"},
 status:"published",version:2,approvedVersion:2,approvedBy:"reviewer-001",
 privateMemo:"PRIVATE-SECRET"
});
test("MANNA Product V1 accepts complete review record",()=>{
 assert.deepEqual(validateForReview(valid()),[]);
});
test("MANNA Product V1 rejects missing essential public fields",()=>{
 for(const [path,update] of [
 ["name",p=>p.name=""],["summary",p=>p.summary="X".repeat(41)],
 ["photos",p=>p.images=[]],["spec",p=>p.specifications={}],
 ["price",p=>p.price.amountMinor=0],["stock",p=>p.inventory.quantity=-1],
 ["delivery",p=>p.delivery.coverage=""],["seller",p=>p.afterSales.sellerLegalName=""],
 ["cost",p=>p.internal.materialMinor=20000],["evidence",p=>p.internal.supplierEvidenceRef=""]
 ]){
  const record=valid();update(record);
  assert.ok(validateForReview(record).length>0,path);
 }
});
test("MANNA V1 public view does not leak supplier cost or private records",()=>{
 const p=valid(),out=publicProduct(p),serialized=JSON.stringify(out);
 for(const secret of ["internal","privateMemo","bankAccount","supplierEvidenceRef",
 "laborMinor","materialMinor","PRIVATE-NOT-PUBLIC","private://supplier-1"])
  assert.ok(!serialized.includes(secret),secret);
 assert.equal(out.price.amountMinor,12800);
 assert.equal(out.images[0].assetKey,"products/example/01.webp");
});
test("MANNA public projection requires current approved revision",()=>{
 const p=valid();
 p.approvedVersion=1;assert.throws(()=>publicProduct(p));
 p.approvedVersion=2;p.status="draft";assert.throws(()=>publicProduct(p));
 p.status="published";p.approvedBy="";assert.throws(()=>publicProduct(p));
});
test("MANNA finance data is integer minor units",()=>{
 const p=valid();p.price.amountMinor=128.9;
 assert.ok(validateForReview(p).includes("price"));
 p.price.amountMinor=12800;p.internal.laborMinor=1.22;
 assert.ok(validateForReview(p).includes("internal.fairness"));
});
