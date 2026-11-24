export const hasCargoRoof=kind=>kind!=='flat';

export const vehicleSpecifications = {
  semi: { length:16.45,width:2.55,height:3.95, cab:2.45, radius:.51, axles:[1.18,3.65,11.82,13.04,14.26], paint:'#267b95', label:'Тягач и полуприцеп' },
  box:  { length:7.42,width:2.4,height:3.32, cab:2.08, radius:.46, axles:[1.16,5.50], paint:'#d08638', label:'Среднетоннажный фургон' },
  cold: { length:8.72,width:2.55,height:3.74, cab:2.46, radius:.50, axles:[1.28,6.39], paint:'#467bb1', label:'Изотермический кузов' },
  van:  { length:5.69,width:2.08,height:2.56, cab:2.18, radius:.36, axles:[.98,4.14], paint:'#ad514d', label:'Цельнометаллический фургон' },
  flat: { length:8.51,width:2.55,height:3.10, cab:3.03, radius:.58, axles:[1.31,5.92,7.14], paint:'#63865b', label:'Бортовая платформа' },
};
