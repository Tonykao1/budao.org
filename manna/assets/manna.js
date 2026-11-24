(() => {
  "use strict";
  const samples = [
    {name:"收纳织物",desc:"收纳与随行。",link:"/manna/goods/sample-01/"},
    {name:"日用器皿",desc:"日常使用。",link:"/manna/goods/sample-02/"},
    {name:"书写纸品",desc:"记录与书写。",link:"/manna/goods/sample-03/"}
  ];
  const sampleButtons = Array.from(document.querySelectorAll("[data-sample]"));
  const sampleName = document.getElementById("sample-name");
  if (sampleName) sampleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.sample);
      const sample = samples[index];
      if (!sample) return;
      sampleButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("selected",selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      sampleName.textContent = sample.name;
      document.getElementById("sample-desc").textContent = sample.desc;
      document.getElementById("sample-link").href = sample.link;
      document.querySelector("#sample-caption small").textContent =
        "展示样品 · " + String(index+1).padStart(2,"0");
    });
  });

  const slider = document.getElementById("labor-range");
  if (slider) {
    const price = 128;
    const fixedCosts = 54 + 18 + 8;
    const update = () => {
      const labor = Math.max(16,Math.min(40, Number(slider.value)||24));
      const surplus = price-fixedCosts-labor;
      document.getElementById("labor-value").textContent = "¥"+labor;
      document.getElementById("labor-reading").textContent = "¥"+labor;
      document.getElementById("surplus-value").textContent = "¥"+surplus;
      document.getElementById("labor-segment").style.setProperty("--share",labor/price*100+"%");
      document.getElementById("surplus-segment").style.setProperty("--share",surplus/price*100+"%");
    };
    slider.addEventListener("input",update);
    document.getElementById("labor-reset")?.addEventListener("click",()=>{
      slider.value="24";update();slider.focus();
    });
    update();
  }

  const tasks = [
    ["选品","确认商品来源、用途和质量。"],
    ["制作","制作与工艺工作。"],
    ["品控","检查品质与商品描述。"],
    ["整理","分拣、包装和资料整理。"],
    ["交付","安排发货与物流。"],
    ["售后","处理退换货和服务问题。"]
  ];
  const workButtons = Array.from(document.querySelectorAll("[data-work]"));
  if (workButtons.length) workButtons.forEach((button) => {
    button.addEventListener("click",()=>{
      const index=Number(button.dataset.work);
      const entry=tasks[index];
      if(!entry)return;
      workButtons.forEach((item)=>{
        const selected=item===button;
        item.classList.toggle("active",selected);
        item.setAttribute("aria-pressed",String(selected));
      });
      document.getElementById("work-count").textContent=String(index+1).padStart(2,"0")+" / 06";
      document.getElementById("work-title").textContent=entry[0];
      document.getElementById("work-description").textContent=entry[1];
    });
  });

  const chapters=Array.from(document.querySelectorAll(".numbered-section[id],.portal[id]"));
  const rail=Array.from(document.querySelectorAll(".rail-item, .space-jump"));
  if(chapters.length && "IntersectionObserver" in window){
    const observer=new IntersectionObserver((entries)=>{
      const showing=entries.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
      if(!showing.length)return;
      const current=showing[0].target.id;
      rail.forEach(a=>{
        const active=a.getAttribute("href")==="#"+current;
        a.classList.toggle("active",active);
        if(active)a.setAttribute("aria-current","location");
        else a.removeAttribute("aria-current");
      });
    },{rootMargin:"-15% 0px -35% 0px",threshold:[0,.15,.35,.6]});
    chapters.forEach(x=>observer.observe(x));
  }

  const dialog=document.getElementById("purchase-demo");
  if(dialog && typeof dialog.showModal==="function") {
    const stages=[
      {title:"商品信息",body:"商品名称、实物图片、规格、来源与库存。"},
      {title:"价格与费用",body:"售价、配送费用及最终应付金额。"},
      {title:"交付与售后",body:"经营主体、预计交付、退换货与联系方式。"},
      {title:"自由确认",body:"可以购买，也可以离开。当前仅为流程演示，不产生订单或付款。"}
    ];
    let step=0;
    const content=document.getElementById("demo-content");
    const back=document.getElementById("demo-back");
    const next=document.getElementById("demo-next");
    const stepBadges=Array.from(dialog.querySelectorAll(".demo-steps span"));
    const render=()=>{
      content.replaceChildren();
      const title=document.createElement("h3");title.textContent=stages[step].title;
      const body=document.createElement("p");body.textContent=stages[step].body;
      content.append(title,body);
      stepBadges.forEach((node,i)=>node.classList.toggle("current",i===step));
      back.disabled=step===0;
      next.textContent=step===stages.length-1?"完成":"下一步 →";
    };
    document.getElementById("open-purchase-demo")?.addEventListener("click",()=>{step=0;render();dialog.showModal();});
    document.getElementById("demo-close")?.addEventListener("click",()=>dialog.close());
    next?.addEventListener("click",()=>{if(step===stages.length-1){dialog.close();return;}step++;render();});
    back?.addEventListener("click",()=>{if(step>0)step--;render();});
    dialog.addEventListener("click",(event)=>{
      if(event.target===dialog)dialog.close();
    });
  }
})();