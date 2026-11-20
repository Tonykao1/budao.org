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
| 一个拥抱 · 一条线路 · 一则故事 · 一段经文 · 一起祷告 | EMBRACE · TRAIL · STORY · SCRIPTURE · PRAYER | 抱擁 · コース · 物語 · 聖句 · 祈り | **ABRAZO · SENDERO · HISTORIA · ESCRITURA · ORACIÓN** |

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

- **Oremos juntos:** invitación a la oración, no a la publicación pública.
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
