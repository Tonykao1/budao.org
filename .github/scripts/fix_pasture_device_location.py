from pathlib import Path
import re
import sys

FILES = [Path('tonglu.html'), Path('tonglu-pasture-portrait.html')]
LOCATION_KEY = "budao:pasture-location:v1"


def refresh_body(text: str) -> str:
    m = re.search(r"async function refresh\(\)\{(?P<body>.*?)\n\}", text, re.S)
    if not m:
        raise AssertionError('refresh() not found')
    return m.group('body')


def verify_file(path: Path) -> None:
    text = path.read_text()
    if 'ipwho.is' in text:
        raise AssertionError(f'{path}: IP geolocation is still present')
    body = refresh_body(text)
    required = [
        'getDeviceLocation()',
        'readSavedLocation()',
        "weatherAt(39.9042,116.4074,'fallback')",
    ]
    positions = []
    for token in required:
        pos = body.find(token)
        if pos < 0:
            raise AssertionError(f'{path}: missing {token}')
        positions.append(pos)
    if positions != sorted(positions):
        raise AssertionError(f'{path}: location priority is not device -> saved -> Beijing fallback')
    if "weatherAt(+g.latitude,+g.longitude,'ip')" in text or ",'ip'" in body:
        raise AssertionError(f'{path}: IP-derived weather source still reachable')
    if LOCATION_KEY not in text:
        raise AssertionError(f'{path}: shared trusted device cache missing')


def verify() -> None:
    for path in FILES:
        verify_file(path)
    print('device-location policy verified')


PORTRAIT_HELPERS = r"""
const LOCATION_KEY='budao:pasture-location:v1';
const LOCATION_MAX_AGE=24*60*60*1000;
function validLocation(v){
 return v&&Number.isFinite(+v.latitude)&&Number.isFinite(+v.longitude)&&Math.abs(+v.latitude)<=90&&Math.abs(+v.longitude)<=180;
}
function readSavedLocation(){
 try{
  const v=JSON.parse(localStorage.getItem(LOCATION_KEY)||'null');
  if(!validLocation(v)||!Number.isFinite(+v.savedAt)||Date.now()-Number(v.savedAt)>LOCATION_MAX_AGE)return null;
  return{latitude:+v.latitude,longitude:+v.longitude,accuracy:Number(v.accuracy)||null};
 }catch(e){return null}
}
function saveLocation(pos){
 try{localStorage.setItem(LOCATION_KEY,JSON.stringify({latitude:+pos.latitude,longitude:+pos.longitude,accuracy:Number(pos.accuracy)||null,savedAt:Date.now()}))}catch(e){}
}
async function getDeviceLocation(){
 if(!navigator.geolocation)return null;
 if(navigator.permissions){
  try{const p=await navigator.permissions.query({name:'geolocation'});if(p.state==='denied')return null}catch(e){}
 }
 return await new Promise(resolve=>{
  navigator.geolocation.getCurrentPosition(
   pos=>resolve({latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy}),
   ()=>resolve(null),
   {maximumAge:300000,timeout:6000,enableHighAccuracy:true}
  );
 });
}
""".strip('\n')

NEW_REFRESH = """async function refresh(){
 const device=await getDeviceLocation();
 if(validLocation(device)){
  saveLocation(device);
  try{await weatherAt(device.latitude,device.longitude,'device');return}catch(e){}
 }
 const saved=readSavedLocation();
 if(validLocation(saved)){
  try{await weatherAt(saved.latitude,saved.longitude,'saved');return}catch(e){}
 }
 try{await weatherAt(39.9042,116.4074,'fallback')}catch(_){}
}"""


def apply_main(path: Path) -> None:
    text = path.read_text()
    old = re.compile(
        r"async function refresh\(\)\{\n"
        r"  const device=await getDeviceLocation\(\);.*?"
        r"\n  try\{\n"
        r"    const ip=await fetch\('https://ipwho\.is/',\{cache:'no-store'\}\),g=await ip\.json\(\);.*?"
        r"\n  \}catch\(e\)\{try\{await weatherAt\(39\.9042,116\.4074,'fallback'\)\}catch\(_\)\{\}\}\n"
        r"\}",
        re.S,
    )
    replacement = """async function refresh(){
  const device=await getDeviceLocation();
  if(validLocation(device)){
    saveLocation(device);
    try{await weatherAt(device.latitude,device.longitude,'device');return}catch(e){}
  }
  const saved=readSavedLocation();
  if(validLocation(saved)){
    try{await weatherAt(saved.latitude,saved.longitude,'saved');return}catch(e){}
  }
  try{await weatherAt(39.9042,116.4074,'fallback')}catch(_){}
}"""
    text2, count = old.subn(replacement, text, count=1)
    if count != 1:
        raise AssertionError('tonglu.html: expected legacy IP fallback block exactly once')
    path.write_text(text2)


def apply_portrait(path: Path) -> None:
    text = path.read_text()
    old_refresh = re.compile(
        r"async function refresh\(\)\{\n"
        r" try\{const ip=await fetch\('https://ipwho\.is/',\{cache:'no-store'\}\),g=await ip\.json\(\);.*?"
        r"\n if\(navigator\.permissions&&navigator\.geolocation\).*?\n"
        r"\}",
        re.S,
    )
    text2, count = old_refresh.subn(NEW_REFRESH, text, count=1)
    if count != 1:
        raise AssertionError('portrait: expected legacy IP-first refresh exactly once')
    if LOCATION_KEY not in text2:
        marker = "async function refresh(){"
        idx = text2.find(marker)
        if idx < 0:
            raise AssertionError('portrait: refresh marker missing after replacement')
        text2 = text2[:idx] + PORTRAIT_HELPERS + "\n" + text2[idx:]
    path.write_text(text2)


def apply() -> None:
    apply_main(FILES[0])
    apply_portrait(FILES[1])
    verify()
    print('device-location repair applied')


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'verify'
    if mode == 'verify':
        verify()
    elif mode == 'apply':
        apply()
    else:
        raise SystemExit('usage: fix_pasture_device_location.py [verify|apply]')
