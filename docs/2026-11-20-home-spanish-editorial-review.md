# BUDAO — Portada en español | revisión editorial y técnica

**Fecha:** 2026-11-20  
**Estado:** BORRADOR de traducción para vista previa. No autoriza publicación en producción.  
**Ámbito:** exclusivamente `/home.html?lang=es`. El resto de las páginas conserva el idioma actual.  
**Fuentes revisadas:** `home.html` (chino), `global/home-i18n.js` (chino original y traducciones vigentes en inglés, chino tradicional y japonés), `prayer-box.js` (texto y flujo de privacidad), `global/i18n-core.js` (idiomas y rutas).

## 1. Decisiones de traducción

- Se privilegia un español internacional, digno y natural, válido tanto para hablantes de España como de América Latina, evitando regionalismos que limiten el ministerio.
- El nombre propio **BUDAO** se mantiene invariable en navegación, encabezado, texto y pie de página. En japonés la versión vigente usa la denominación **道行（みちゆき）**, que se estudia como modelo de adaptación cultural, **no** como traducción española del nombre.
- El sentido cristológico de «el camino, la verdad y la vida» se preserva (Juan 14:6). `el Señor`, `su Reino` y `su camino` se usan con atención a su contexto teológico. El posesivo **su** se escribe en minúsculas conforme al uso habitual del español, sin negar la reverencia que el original chino expresa con **祂**.
- La declaración «余生行走，不偏左右» no es publicidad turística: sostiene una confesión de caminar por el camino del Señor sin desviarse.
- `✦ La hoguera` y `❦ Chispas del camino` son propuestas literarias para los dos apartados. Conservar símbolos y enlaces; no cambiar sus marcas ni funcionalidad interna.
- Se conservan las opciones de consentimiento, la privacidad, el envío y la información de contacto tal como operan en el sistema original. Solo se traduce el texto visible; ningún dato de oración se envía a un servicio de traducción.

## 2. Traducción española de la portada

| 中文（母本） | English (current) | 日本語（現行） | Español (propuesta) |
| --- | --- | --- | --- |
| 步道 | BUDAO | 道行 | **BUDAO** |
| 余生行走，不偏左右 | Till our final day, we shall walk in His way; Neither left nor right shall we stray. | これからの人生、主の道を歩み、右にも左にもそれず。 | **Hasta el último día, andaremos por su camino; sin desviarnos ni a la izquierda ni a la derecha.** |
| 我们在做什么？ | What do we do? | 私たちは何をしているのでしょうか？ | **¿Qué hacemos?** |
| 健行于天地，相知于彼此，在旷野经历与祂的同在。 | We walk the earth beneath the heavens, come to know one another, and encounter His presence in the wilderness. | 空と大地の間を歩み、互いを知り、荒野で主の臨在に触れます。 | Caminamos entre el cielo y la tierra; nos conocemos unos a otros y experimentamos la presencia del Señor en el desierto. |
| 为什么是“步道”？ | Why BUDAO? | なぜ「道行」なのでしょうか？ | **¿Por qué BUDAO?** |
| 祂就是道路、真理、生命。唯有祂亲自感动你同行天路，共步主道。 | He is the way, the truth, and the life. He alone can stir our hearts to journey heavenward together, following His way. | イエス・キリストは道であり、真理であり、いのちです。主ご自身が私たちの心を動かしてくださるとき、私たちは天の御国を目指し、主の道をともに歩むのです。 | Él es el camino, la verdad y la vida. Solo Él puede conmover nuestros corazones para que caminemos juntos hacia su Reino, siguiendo su camino. |
| “步道”有什么？ | What will you find at BUDAO? | 「道行」で何に出会える？ | **¿Qué encontrarás en BUDAO?** |
| 一个拥抱 · 一条线路 · 一则故事 · 一段经文 · 一起祷告 | ONE EMBRACE · ONE ROUTE · ONE STORY · ONE SCRIPTURE PASSAGE · PRAY TOGETHER | ひとつの抱擁 · ひとつのコース · ひとつの物語 · 聖書の一箇所 · ともに祈る | **UN ABRAZO · UNA RUTA · UNA HISTORIA · UN PASAJE BÍBLICO · OREMOS JUNTOS** |

### Declaración de fe: estructura interactiva

Para conservar los cuatro mandos originales de sonido, el texto se reparte en el mismo `header .hero-line` alrededor de `dspBtn`, `playBtn`, `prevBtn` y `nextBtn`. No se sustituye el nodo completo, no se reemplaza el reproductor ni se envía contenido a un traductor externo.

La redacción española todavía requiere un último examen de estilo y teología antes de su publicación definitiva.

## 3. Seis apartados del menú

| 中文 | Español | Criterio |
| --- | --- | --- |
| 首页 | Inicio | entrada a la portada |
| 步道 | BUDAO | nombre propio |
| 童行 | Niños en camino | dimensión infantil, caminar acompañados |
| 同道 | Compañeros de camino | comunidad y camino compartido |
| 同工 | Colaboradores | personas que sirven juntas |
| 牧场 | Pradera | ámbito pastoral y metáfora de la comunidad |

Los seis enlaces y el diseño geométrico del menú se conservan. El botón **ES** pertenece solo a la portada y ofrece en cada idioma las otras cuatro opciones.

## 4. Oración: permisos y privacidad

- **Oremos juntos** es el título de la ventana de oración; **OREMOS JUNTOS** en el conjunto de los cinco es el mismo acto y abre ese diálogo, no una página ni una publicación pública.
- **Solo los líderes de BUDAO leerán esta petición y orarán por mí:** corresponde a la opción original de acceso limitado a líderes.
- **Autorizo al líder a invitar a colaboradores de confianza a orar también por esta petición:** corresponde a una autorización *separada* para el grupo de confianza.
- **Quiero recibir una respuesta privada de un líder:** contacto opcional únicamente si se pide respuesta.
- **Tu petición no se hará pública:** se conserva la promesa expresa de privacidad, sin ampliar los destinatarios.
- **Enviar petición:** textos de progreso, fallo y confirmación traducidos en el navegador.
- Ningún valor de `visibility`, API, cifrado, `idempotencyKey`, control de permisos o base de datos se modifica.

## 5. Publicación y pruebas

- [ ] Traducción española revisada por un hispanohablante nativo con sensibilidad bíblica.
- [ ] Revisión lingüística de consentimientos y privacidad, tanto para España como para América Latina.
- [ ] Confirmación visual y funcional en ordenador, móvil y tamaños de navegador de vehículos (Tesla).
- [ ] Pruebas del cambio de cinco idiomas dentro de la misma página; conservar estados de reproducción musical.
- [ ] Vercel: compilación de vista previa aprobada y URL accesible.
- [ ] Aprobación del responsable antes de combinar en `main` y publicar.

**Nota:** el hecho de desarrollar la versión española no autoriza implícitamente su activación en el sitio público. Los otros cuatro idiomas continúan siendo la fuente inalterada.


## 6. 对照审校：步道「五个一」（中文审核母表）

**原文固定：一个拥抱 · 一条线路 · 一则故事 · 一段经文 · 一起祷告。** 这是“四件具体礼物 + 一项同行行动”，并非五个抽象话题；中文、繁体中文的原文与交互结构不动。

| 序号 | 中文必须守住的意义 | English · 英文拟修改 | 日本語 · 日文拟修改 | Español · 西语拟修改 | 西语独立中文回译 |
| --- | --- | --- | --- | --- | --- |
| 01 | 一次真实而具体的拥抱 | ONE EMBRACE | ひとつの抱擁 | UN ABRAZO | 一个拥抱 |
| 02 | 一条已规划、可发布或同行的线路，不是泛指山路 | ONE ROUTE | ひとつのコース | UNA RUTA | 一条路线 |
| 03 | 一则真实的生命故事 | ONE STORY | ひとつの物語 | UNA HISTORIA | 一个故事 |
| 04 | 一段取自圣经的经文，可以是多节，不等于整部圣经或“写作” | ONE SCRIPTURE PASSAGE | 聖書の一箇所 | UN PASAJE BÍBLICO | 一段圣经经文 |
| 05 | 一起向神祷告的邀请，必须有“共同参与”，并仍是按钮 | PRAY TOGETHER | ともに祈る | OREMOS JUNTOS | 让我们一起祷告 |

### 对前一稿的纠偏

- `SENDERO` 只是小径、山径，容易误写「一条线路」；新选 `UNA RUTA` 强调路线与行走安排。
- `ESCRITURA` 无明确限定时可能指“书写”，即使宗教上下文可理解，单独陈列仍不够准确；新选 `UN PASAJE BÍBLICO`。
- `ORACIÓN` 只是“祷告”这项名词，省略了“一起”；新选 `OREMOS JUNTOS`，是真实邀请，仍可点击打开原祷告弹窗。
- 英文先前采取五个大写名词的节奏方案，但不是逐项语义完全对应。拟将 `TRAIL / SCRIPTURE / PRAYER` 细化为 `ONE ROUTE / ONE SCRIPTURE PASSAGE / PRAY TOGETHER`，保留四份礼物与同行行动。
- 日文当前发布版是压缩名词式 `抱擁 · コース · 物語 · 聖句 · 祈り`；拟在此次**审阅分支**上补回可感知的“一”和“共同祷告”，不改变日本版获批的品牌 **道行（みちゆき）**。

### 复核的其他重点（建议中文审核）

- **品牌**：中文/繁体 `步道`、英文/西文 `BUDAO`、日文 `道行（みちゆき）`；不得将 BUDAO 自动翻译为「布道」。
- **信仰宣言**：必须指向在主的道路上行走到底、不偏左右；并保留原四个音乐控制元素。它是创作文案，不得冒充圣经逐字引文。
- **三段宣言**：天地间的行走、彼此相识、旷野经历主的同在；「祂是道路、真理、生命」须保留明确的基督论含义。
- **祷告隐私**：仅带领人阅读、受托同工需另行同意、私人回复需用户选择、用户内容不公开。禁止把任何祷告正文交给外部翻译服务。

### 发布边界

本表明确了语义约束，**不意味着四种外文的词句都已通过母语者审核**。英语和日语在正式站已有旧文案，拟议修改仅存在于该西语审阅分支；无发布授权前不得合并。
