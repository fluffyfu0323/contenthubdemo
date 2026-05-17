/**
 * data.js — Paper Style 数据层
 * 完全复用原始 inspiration-page 的文物、地点和历史 timeline 数据
 */

export const TIME_PERIODS = [
  { key: "prehistoric", name: "史前时期", range: [-3000000, -3000], color: "#D4853F" },
  { key: "ancient",     name: "古代文明", range: [-3000, -500],     color: "#FFD700" },
  { key: "classical",   name: "古典时期", range: [-500, 500],       color: "#FF8C42" },
  { key: "medieval",    name: "中世纪",   range: [500, 1500],       color: "#6EB5FF" },
  { key: "renaissance", name: "文艺复兴", range: [1500, 1700],      color: "#C084FC" },
  { key: "modern",      name: "近代",     range: [1700, 1900],      color: "#4ADE80" },
  { key: "contemporary",name: "现代",     range: [1900, 2024],      color: "#FF6B6B" }
];

function wimg(filename) {
  return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(filename) + '?width=300';
}

const CC={
  "Egypt":{lat:27,lng:30,s:3},"China":{lat:35,lng:105,s:8},"Iraq":{lat:33.2,lng:43.7,s:2},
  "Greece":{lat:39,lng:22,s:2},"Italy":{lat:42.8,lng:12.5,s:3},"France":{lat:46.6,lng:2.3,s:3},
  "Iran":{lat:32.4,lng:53.7,s:4},"India":{lat:22,lng:78,s:6},"Japan":{lat:36.2,lng:138.2,s:3},
  "Mexico":{lat:23.6,lng:-102.5,s:4},"Peru":{lat:-10,lng:-76,s:3},
  "Germany":{lat:51.2,lng:10.4,s:2},"Netherlands":{lat:52.1,lng:5.3,s:1},
  "Spain":{lat:40.4,lng:-3.7,s:3},"United Kingdom":{lat:53.5,lng:-2,s:2},
  "Turkey":{lat:39,lng:35,s:3},"Pakistan":{lat:30.4,lng:69.3,s:3},
  "Nigeria":{lat:9.1,lng:7.5,s:2},"Cambodia":{lat:12.6,lng:104.9,s:1},
  "United States":{lat:39.8,lng:-98.6,s:8},"Norway":{lat:60.5,lng:8.5,s:2},
  "Korea":{lat:37.5,lng:127,s:2},"Indonesia":{lat:-2.5,lng:118,s:5},
  "Austria":{lat:47.5,lng:14.6,s:1},"Russia":{lat:55.8,lng:37.6,s:3},
};
const _sc={};
function getCoords(c){
  if(!c||!CC[c])return null;const e=CC[c];if(!_sc[c])_sc[c]=0;
  const i=_sc[c]++;const a=i*2.399963;
  const r=e.s*0.3*Math.sqrt(i+1)/Math.sqrt(10);
  return{lat:e.lat+r*Math.cos(a),lng:e.lng+r*Math.sin(a)};
}
export function resetSpreadCounters(){for(const k of Object.keys(_sc))_sc[k]=0;}

export function yearToPeriod(b,e){
  const y=(b+e)/2;
  for(const p of TIME_PERIODS)if(y>=p.range[0]&&y<p.range[1])return p;
  return y<-3000?TIME_PERIODS[0]:TIME_PERIODS[6];
}

function mk(id,name,country,year,yd,wikiFilename,ex={}){
  const p=yearToPeriod(year,year);
  const co=getCoords(country);if(!co)return null;
  return{
    id:`met:${id}`,metObjectID:id,name,
    period:p.key,periodName:p.name,
    region:country.toLowerCase().replace(/\s+/g,'_'),regionName:country,
    lat:co.lat,lng:co.lng,museum:'The Metropolitan Museum of Art',
    thumbnail:wimg(wikiFilename),fullImage:wimg(wikiFilename),
    description:ex.desc||'',year,yearDisplay:yd||String(year),
    tags:ex.tags||[],culture:ex.culture||'',
    artist:ex.artist||'',department:ex.dept||'',
    sourceUrl:`https://www.metmuseum.org/art/collection/search/${id}`,
    isPublicDomain:true,
  };
}

const PREBUILT = {
  prehistoric: [
    mk(544,'William the Hippopotamus','Egypt',-1900,'ca. 1961–1878 B.C.','Hippopotamus_from_Thebes.jpg',{culture:'Middle Kingdom Egypt',tags:['faience','hippo']}),
    mk(547,'Sphinx of Hatshepsut','Egypt',-1470,'ca. 1479–1458 B.C.','Hatshepsut.jpg',{culture:'New Kingdom Egypt',tags:['granite','sphinx']}),
    mk(570,'Mask of Tutankhamun','Egypt',-1323,'ca. 1323 B.C.','CaijrodeTutworkkamón.jpg',{culture:'New Kingdom Egypt',tags:['gold','mask']}),
    mk(590,'Nefertiti Bust','Egypt',-1345,'ca. 1345 B.C.','Nofretete_Neues_Museum.jpg',{culture:'New Kingdom Egypt',tags:['limestone','bust']}),
    mk(551,'Rosetta Stone','Egypt',-196,'196 B.C.','Rosetta_Stone.JPG',{culture:'Ptolemaic Egypt',tags:['stone','hieroglyphs']}),
  ],
  ancient: [
    mk(544214,'Standard of Ur','Iraq',-2600,'ca. 2600 B.C.','Standard_of_Ur_-_War.jpg',{culture:'Sumerian',tags:['mosaic','war']}),
    mk(312595,'Lamassu','Iraq',-870,'ca. 883–859 B.C.','Lammasu.jpg',{culture:'Assyrian',tags:['stone','guardian']}),
    mk(548,'Temple of Dendur','Egypt',-15,'ca. 15 B.C.','Temple_of_Dendur_Met_jeh.jpg',{culture:'Roman Egypt',tags:['temple','sandstone']}),
    mk(40060,'Sanxingdui Bronze Mask','China',-1200,'ca. 1200 B.C.','Sanxingdui_Oct_2007_554.jpg',{culture:'Shang Dynasty',tags:['bronze','mask']}),
    mk(547802,'Cyrus Cylinder','Iran',-539,'ca. 539 B.C.','Cyrus_Cylinder.jpg',{culture:'Achaemenid Persia',tags:['clay','cylinder']}),
    mk(551,'Ishtar Gate','Iraq',-575,'ca. 575 B.C.','Ishtar_gate_in_Pergamon_museum.jpg',{culture:'Neo-Babylonian',tags:['brick','gate']}),
  ],
  classical: [
    mk(248892,'Venus de Milo','Greece',-130,'ca. 130–100 B.C.','Venus_de_Milo_Louvre_Ma399_n4.jpg',{culture:'Hellenistic Greek',tags:['marble','sculpture']}),
    mk(254523,'Winged Victory of Samothrace','Greece',-190,'ca. 190 B.C.','Nike_of_Samothrace.jpg',{culture:'Hellenistic Greek',tags:['marble','Nike']}),
    mk(245376,'Augustus of Prima Porta','Italy',-20,'ca. 1st century A.D.','Statue-Augustus.jpg',{culture:'Roman',tags:['marble','emperor']}),
    mk(39918,'Gandhara Buddha','Pakistan',200,'3rd century A.D.','Maitreya_Gandhara.jpg',{culture:'Gandhara',tags:['schist','Buddha']}),
    mk(38164,'Terracotta Army','China',-210,'ca. 210 B.C.','Terracotta_pbread1.jpg',{culture:'Qin Dynasty',tags:['terracotta','army']}),
    mk(44651,'Pompeii Fresco','Italy',60,'1st century A.D.','Pompeii_-_Casa_dei_Vettii_-_Ixion.jpg',{culture:'Roman',tags:['fresco','painting']}),
  ],
  medieval: [
    mk(469983,'Sutton Hoo Helmet','United Kingdom',625,'ca. 625 A.D.','Sutton_Hoo_helmet_2016.png',{culture:'Anglo-Saxon',tags:['iron','helmet']}),
    mk(449533,'Alhambra Tile','Spain',1350,'ca. 14th century','Tile_from_the_Alhambra.jpg',{culture:'Nasrid Islamic',tags:['tile','mosaic']}),
    mk(39799,'Song Dynasty Celadon','China',1150,'12th century','Longquan_Celadon_Kinuta.jpg',{culture:'Song Dynasty',tags:['celadon','porcelain']}),
    mk(38574,'Shiva Nataraja','India',1100,'ca. 11th century','Shiva_as_the_Lord_of_Dance_LACMA.jpg',{culture:'Chola Dynasty',tags:['bronze','Shiva']}),
    mk(466176,'Notre-Dame Rose Window','France',1250,'ca. 1250','North_rose_window_of_Chartres_Cathedral.jpg',{culture:'French Gothic',tags:['glass','cathedral']}),
    mk(471902,'Bayeux Tapestry','France',1070,'ca. 1070','Bayeux_Tapestry_scene23_Harold_oath_William.jpg',{culture:'Norman',tags:['embroidery','history']}),
    mk(50611,'Tale of Genji Scroll','Japan',1130,'12th century','Genji_emaki_HASHIHIME.jpg',{culture:'Heian Period',tags:['painting','scroll']}),
    mk(448655,'Angkor Wat Relief','Cambodia',1150,'12th century','Awatdevatasupperlevel01.JPG',{culture:'Khmer',tags:['stone','relief']}),
  ],
  renaissance: [
    mk(437133,'Self-Portrait (Rembrandt)','Netherlands',1660,'1660','Rembrandt_van_Rijn_-_Self-Portrait_-_Google_Art_Project.jpg',{artist:'Rembrandt',culture:'Dutch',tags:['oil','portrait']}),
    mk(437869,'The Lute Player (Caravaggio)','Italy',1596,'ca. 1596','The_Lute_Player-Caravaggio_(Hermitage).jpg',{artist:'Caravaggio',culture:'Italian',tags:['oil','Baroque']}),
    mk(437397,'Girl with a Pearl Earring','Netherlands',1665,'ca. 1665','Meisje_met_de_parel.jpg',{artist:'Vermeer',culture:'Dutch',tags:['oil','portrait']}),
    mk(436896,'The Birth of Venus','Italy',1485,'ca. 1485','Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg',{artist:'Botticelli',culture:'Italian',tags:['tempera','Renaissance']}),
    mk(42154,'Ming Dynasty Vase','China',1550,'16th century','Ming_dynasty_Xuande_mark_and_period_(1426–35)_imperial_blue_and_white_vase.jpg',{culture:'Ming Dynasty',tags:['porcelain','blue-white']}),
    mk(453369,'Iznik Pottery','Turkey',1575,'ca. 1575','Dish_with_leaf_and_flower_design,_Turkey,_Iznik,_late_16th_century,_stonepaste_with_polychrome_painting_under_transparent_glaze_-_Cincinnati_Art_Museum_-_DSC04516.JPG',{culture:'Ottoman',tags:['tile','ceramic']}),
    mk(24920,'Benin Bronze Head','Nigeria',1550,'16th century','Benin_Bronze_Head.jpg',{culture:'Benin Kingdom',tags:['bronze','head']}),
  ],
  modern: [
    mk(436965,'Water Lilies (Monet)','France',1906,'1906','Claude_Monet_-_Water_Lilies_-_1906,_Ryerson.jpg',{artist:'Claude Monet',tags:['oil','Impressionism']}),
    mk(437984,'Starry Night','France',1889,'1889','Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',{artist:'Van Gogh',tags:['oil','Post-Impressionism']}),
    mk(437153,'The Dance Class','France',1874,'1874','Edgar_Degas_-_The_Dance_Class_-_Google_Art_Project.jpg',{artist:'Edgar Degas',tags:['oil','ballet']}),
    mk(436532,'Madame X','France',1884,'1883–84','Sargent_MadameX.jpg',{artist:'Sargent',tags:['oil','portrait']}),
    mk(45434,'The Great Wave','Japan',1831,'ca. 1830–32','Tsunami_by_hokusai_19th_century.jpg',{artist:'Hokusai',culture:'Edo',tags:['woodblock','ukiyo-e']}),
    mk(436535,'Washington Crossing the Delaware','United States',1851,'1851','Emanuel_Leutze_(American,_Schwäbisch_Gmünd_1816–1868_Washington,_D.C.)_-_Washington_Crossing_the_Delaware_-_Google_Art_Project.jpg',{artist:'Leutze',tags:['oil','history']}),
    mk(436001,'Wanderer above the Sea of Fog','Germany',1818,'ca. 1818','Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg',{artist:'C.D. Friedrich',tags:['oil','Romanticism']}),
  ],
  contemporary: [
    mk(483813,'The Steerage','United States',1907,'1907','Alfred_Stieglitz_-_The_Steerage_-_Google_Art_Project.jpg',{artist:'Stieglitz',tags:['photography']}),
    mk(490001,'Composition with Red Blue Yellow','Netherlands',1930,'1930','Piet_Mondriaan,_1930_-_Mondrian_Composition_II_in_Red,_Blue,_and_Yellow.jpg',{artist:'Mondrian',tags:['abstract','oil']}),
    mk(484234,'No. 5 (Pollock)','United States',1948,'1948','No._5,_1948.jpg',{artist:'Pollock',tags:['abstract','drip']}),
    mk(489001,'Nighthawks','United States',1942,'1942','Nighthawks_by_Edward_Hopper_1942.jpg',{artist:'Hopper',tags:['oil','realism']}),
    mk(487001,'American Gothic','United States',1930,'1930','Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg',{artist:'Grant Wood',tags:['oil']}),
    mk(267838,'Guernica','Spain',1937,'1937','PicassoGuernica.jpg',{artist:'Picasso',tags:['oil','anti-war']}),
    mk(488001,'The Son of Man','Spain',1964,'1964','Magritte_TheSonOfMan.jpg',{artist:'Magritte',tags:['oil','Surrealism']}),
  ],
};

function buildAll(){
  const db={};
  for(const[k,items]of Object.entries(PREBUILT)){
    resetSpreadCounters();
    db[k]=items.filter(Boolean);
  }
  return db;
}
const DB=buildAll();

const _cache={};
export async function getCachedAssetsForPeriod(periodKey,targetCount=20,onProgress=null){
  if(_cache[periodKey])return _cache[periodKey];
  resetSpreadCounters();
  const assets=(DB[periodKey]||[]).map(a=>{
    const co=getCoords(a.regionName);
    if(co){a.lat=co.lat;a.lng=co.lng;}
    return a;
  });
  if(onProgress)onProgress(assets.length,assets.length);
  _cache[periodKey]=assets;
  return assets;
}

export function getAssetsByPeriod(k){return _cache[k]||DB[k]||[];}
export function getPeriodConfig(k){return TIME_PERIODS.find(p=>p.key===k);}
export const CULTURE_ASSETS=[];
