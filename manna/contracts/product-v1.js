"use strict";
/**
 * MANNA Product V1 — pure data contract, not a database/API implementation.
 * Never trust client role or approvalVersion. The future backend must derive both.
 */
const SCHEMA_VERSION="manna.product.v1";
const STATUSES=Object.freeze(["draft","changes","review","approved","published","archived"]);
const CURRENCIES=Object.freeze(["CNY","USD","EUR","GBP","JPY"]);
const MONEY_MAX=999999999999;
function filled(s,max=1000){return typeof s==="string"&&s.trim().length>0&&s.length<=max}
function minor(n){return Number.isSafeInteger(n)&&n>=0&&n<=MONEY_MAX}
function validateForReview(p){
 const issues=[];
 const requireField=(pass,field)=>{if(!pass)issues.push(field)};
 if(!p||typeof p!=="object"||Array.isArray(p))return ["product"];
 requireField(p.schemaVersion===SCHEMA_VERSION,"schemaVersion");
 requireField(filled(p.id,120),"id");
 requireField(filled(p.sku,70),"sku");
 requireField(filled(p.name,70),"name");
 requireField(filled(p.summary,40),"summary");
 requireField(filled(p.category,60),"category");
 const specs=p.specifications;
 requireField(specs&&typeof specs==="object"&&!Array.isArray(specs)&&
  Object.values(specs).some(v=>filled(v,240)),"specifications");
 const photos=p.images;
 requireField(Array.isArray(photos)&&photos.length>=1&&photos.length<=5&&photos.every(x=>
  x&&filled(x.assetKey,400)&&filled(x.alt,140)&&
  Number.isSafeInteger(x.position)&&x.position>=0&&
  x.verified===true)&&photos.filter(x=>x.primary===true).length===1&&
  new Set(photos.map(x=>x.position)).size===photos.length,"images");
 const price=p.price;
 requireField(price&&CURRENCIES.includes(price.currency)&&minor(price.amountMinor)&&
  price.amountMinor>0,"price");
 const inv=p.inventory;
 requireField(inv&&["in_stock","preorder","sold_out"].includes(inv.mode)&&
  Number.isSafeInteger(inv.quantity)&&inv.quantity>=0&&inv.quantity<=999999&&
  (inv.mode!=="in_stock"||inv.quantity>0),"inventory");
 const delivery=p.delivery;
 requireField(delivery&&filled(delivery.origin,120)&&filled(delivery.coverage,240)&&
  filled(delivery.dispatchEstimate,180)&&filled(delivery.shippingPolicy,240)&&
  minor(delivery.shippingMinor),"delivery");
 const after=p.afterSales;
 requireField(after&&filled(after.sellerLegalName,180)&&filled(after.policy,500)&&
  filled(after.contact,180),"afterSales");
 const internal=p.internal;
 requireField(internal&&filled(internal.supplierEvidenceRef,400)&&
  ["materialMinor","laborMinor","fulfillmentMinor","afterSalesReserveMinor"].every(k=>
  minor(internal[k])),"internal.fairness");
 if(price&&minor(price.amountMinor)&&internal&&
   ["materialMinor","laborMinor","fulfillmentMinor","afterSalesReserveMinor"].every(k=>minor(internal[k]))){
  const total=internal.materialMinor+internal.laborMinor+internal.fulfillmentMinor+internal.afterSalesReserveMinor;
  requireField(Number.isSafeInteger(total)&&total<=price.amountMinor,"internal.costBalance");
 }
 return issues;
}
function publicProduct(p){
 if(!p||p.status!=="published"||!Number.isSafeInteger(p.version)||
    p.version<1||p.approvedVersion!==p.version||!filled(p.approvedBy,120)){
   throw new Error("MANNA_PUBLIC_PRODUCT_NOT_APPROVED");
 }
 const errors=validateForReview(p);
 if(errors.length)throw new Error("MANNA_INVALID_PRODUCT:"+errors.join(","));
 const publicImages=p.images.slice().sort((a,b)=>a.position-b.position).map(x=>({
  assetKey:x.assetKey,alt:x.alt,primary:x.primary,position:x.position
 }));
 // Whitelist-only: never spread raw product or any internal source/cost/evidence data.
 return Object.freeze({
  schemaVersion:SCHEMA_VERSION,id:p.id,sku:p.sku,name:p.name,summary:p.summary,
  category:p.category,specifications:{...p.specifications},
  description:typeof p.description==="string"?p.description:"",
  images:publicImages,
  price:{currency:p.price.currency,amountMinor:p.price.amountMinor},
  inventory:{mode:p.inventory.mode,quantity:p.inventory.quantity},
  delivery:{origin:p.delivery.origin,coverage:p.delivery.coverage,
    dispatchEstimate:p.delivery.dispatchEstimate,
    shippingPolicy:p.delivery.shippingPolicy,shippingMinor:p.delivery.shippingMinor},
  afterSales:{sellerLegalName:p.afterSales.sellerLegalName,
    policy:p.afterSales.policy,contact:p.afterSales.contact}
 });
}
module.exports={SCHEMA_VERSION,STATUSES,CURRENCIES,validateForReview,publicProduct};
