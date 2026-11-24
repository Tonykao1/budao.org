(() => {
  "use strict";
  const samples = [
    {name:"收纳织物",desc:"从材质、做工与实际用途开始认识一件东西。",link:"/manna/goods/sample-01/"},
    {name:"日用器皿",desc:"一件日用品，应当经得起日常使用与清楚的品质说明。",link:"/manna/goods/sample-02/"},
    {name:"书写纸品",desc:"让来源、纸张与制作环节，比促销话语更先被看见。",link:"/manna/goods/sample-03/"}
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
        "概念样品 " + String(index+1).padStart(2,"0") + " / 非上架商品";
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
    ["选品：对顾客负责","查证来源、品质与用途，先问这件商品是否真的值得推荐。"],
    ["制作：让技能有价值","工艺与劳动得到适当报酬，不因身份、身体条件或信仰被压低价值。"],
    ["品控：以诚实守护信任","检查承诺与实物是否一致，发现问题便改正，不将缺陷转嫁给顾客。"],
    ["整理：在细节里尽责","分拣、包装、记录和内容整理，同样是应被尊重和计酬的劳动。"],
    ["交付：答应的就认真完成","准确告知运费、时间、运送风险与履约责任，不用夸大承诺催促成交。"],
    ["售后：交易完成，责任仍在","按照公示规则处理退换货、退款与投诉，让顾客知道谁来负责。"]
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
  const rail=Array.from(document.querySelectorAll(".rail-item"));
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
      {title:"先认识商品",body:"示例：收纳织物。真正的购买前，你应当看到真实照片、材质、规格、来源和库存。目前这里只是设计样品，没有真实货品。"},
      {title:"先看清应付什么",body:"演示价 ¥128 不是真实售价。正式交易必须明确商品价格、运费、税费（如适用）、支付币种和总应付金额；不得在最后一步偷偷添加费用。"},
      {title:"再确认由谁负责",body:"正式商店必须在付款前展示真实经营主体、发货与退换货条件、隐私说明及联系方式。买拿不会拿属灵身份替代法定的售后责任。"},
      {title:"你可以选择不购买",body:"演示结束。这里不会生成订单、收取货款或保存信息。真实交易系统只有在商户、支付、库存和售后全部验收后才会启用。"}
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
      next.textContent=step===stages.length-1?"结束演示":"我理解，继续 →";
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