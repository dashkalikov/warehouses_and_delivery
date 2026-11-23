// Each atlas uses equally sized square cells in row order.
const atlases=[
  ['mechanical',3,['CMP-6205','CMP-HF26','CMP-M80','TLS-S108','TLS-CYL','TLS-CAL','PKG-C64','PKG-S23','PKG-L58']],
  ['consumer',3,['HME-K17','HME-M20','HME-V18','RTL-P04','RTL-GL12','RTL-C05','CLD-M10','CLD-Y12','CLD-CH1']],
  ['food',2,['FOD-W06','FOD-R10','FOD-T06','custom']],
];

const images=new Map(atlases.flatMap(([name,columns,items])=>items.map((sku,index)=>[
  sku,{
    src:`/assets/cargo/${name}.webp`,
    size:columns*100,
    x:(index%columns)*100/(columns-1),
    y:Math.floor(index/columns)*100/(columns-1),
  },
])));

export function productImage(product) {
  return images.get(product.group==='custom'?'custom':product.sku)??null;
}
