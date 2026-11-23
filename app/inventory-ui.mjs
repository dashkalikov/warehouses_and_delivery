import { inventorySummary, productGroups } from './inventory.mjs';
import { zones } from './data.mjs';
import { escapeText, icon, num } from './ui.mjs';
import { productImage } from './product-images.mjs';

const groupIcons={parts:'tool',tools:'settings',home:'screen',retail:'box',pack:'layers',cold:'snow',food:'box',custom:'truck'};
const quantity=value=>num(value)+' ед.';
const weight=kg=>kg>=1000?num(kg/1000,2)+' т':num(kg,2)+' кг';
const clean=value=>value.toLowerCase().replaceAll('ё','е').trim();
const areaName=id=>zones.find(zone=>zone.id===id)?.name;
const tag=(id)=>escapeText(productGroups[id]);

function photo(product,description='') {
  const picture=productImage(product);
  if(!picture) return `<span class="product-icon group-${product.group}">${icon(groupIcons[product.group],18)}</span>`;
  const {src,size,x,y}=picture;
  const label=description?`role="img" aria-label="${escapeText(description)}"`:'aria-hidden="true"';
  return `<span class="product-photo" ${label} style="--product-image:url('${src}');--product-size:${size}%;--product-position:${x}% ${y}%"></span>`;
}

export function cargoPreview(rows,phase) {
  if(phase==='done') return '<p class="cargo-preview-note">Кузов пуст. Изображения доставленных товаров доступны во вкладке «Груз».</p>';
  if(!rows.length) return '<p class="cargo-preview-note">Кузов пуст.</p>';
  return `<div class="cargo-preview-head"><h3>${phase==='loading'?'Груз к загрузке':'Груз по ведомости'}</h3></div>
    <div class="cargo-preview-list">${rows.map(({product,units})=>`<button class="cargo-preview-item" type="button" data-action="cargo-product" data-id="${escapeText(product.sku)}">
      ${photo(product)}<span><b>${escapeText(product.name)}</b><small>${product.group==='custom'?'Пример упаковки':quantity(units)}</small></span>
    </button>`).join('')}</div>`;
}

export function inventoryPanel(rows,{warehouse,phase}) {
  const summary=inventorySummary(rows);
  const title=warehouse?'Товары на складе':phase==='done'?'Ведомость доставленного груза':'Состав груза';
  const detail=warehouse?'Остатки по товарным позициям и местам хранения.':{
    loading:'Груз к загрузке по заданию рейса.',
    active:'Груз в кузове по ведомости рейса.',
    unloading:'Партия на разгрузке по ведомости рейса.',
    done:'Машина разгружена. Состав партии сохранён в ведомости.',
  }[phase]??'Позиции по транспортному заданию.';
  if(!rows.length) return `<div class="inventory-head"><h3>${title}</h3></div><div class="inventory-empty">${icon('box',24)}
    <div><b>Кузов пуст</b><p>Товары появятся после назначения рейса.</p></div></div>`;
  return `<div id="inventory-index">
    <div class="inventory-head"><h3>${title}</h3><p>${detail}</p></div>
    <div class="inventory-stats">
      ${[['Всего единиц',num(summary.units)],['Позиций',num(summary.skus)],['Палеты',num(summary.pallets)],['Масса брутто',weight(summary.kg)]]
        .map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join('')}
    </div>
    <div class="inventory-groups-head"><h4>По товарным группам</h4><button class="text-btn" type="button" data-action="inventory-group" data-id="all" aria-pressed="true">Все группы</button></div>
    <div class="inventory-groups" role="group" aria-label="Товарные группы">${summary.groups.map(group=>{
      const share=Math.round(group.units/summary.units*100);
      return `<button type="button" data-action="inventory-group" data-id="${group.id}" aria-pressed="false" class="inventory-group">
        <span class="product-icon group-${group.id}">${icon(groupIcons[group.id],16)}</span>
        <span class="inventory-group-label"><b>${tag(group.id)}</b><small>${group.skus} поз. · ${quantity(group.units)}</small></span>
        <span class="inventory-share"><b>${share}%</b><i style="--share:${share}%"></i></span>
      </button>`;
    }).join('')}</div>
    <div class="inventory-search"><label for="inventory-query" class="sr-only">Поиск товара</label>${icon('search',17)}<input id="inventory-query" type="search" placeholder="Найти по названию или артикулу"><span id="inventory-count" aria-live="polite"></span></div>
    <div id="inventory-results"></div></div>
    <div id="inventory-product" hidden></div>`;
}

export function filterInventory(rows,group,query) {
  const word=clean(query);
  return rows.filter(({product,location})=>{
    const terms=[product.name,product.sku,product.description,productGroups[product.group],location].join(' ');
    return (group==='all'||product.group===group)&&(!word||clean(terms).includes(word));
  });
}

export function inventoryRows(rows,warehouse) {
  if(!rows.length) return '<p class="empty-state">Товары по заданному фильтру не найдены.</p>';
  return `<div class="table-wrap inventory-table-wrap"><table class="inventory-table">
    <thead><tr><th>Товар</th><th>Количество</th><th>Палеты</th><th>${warehouse?'Ячейка':'Брутто'}</th></tr></thead>
    <tbody>${rows.map(({product,units,pallets,kg,location})=>`<tr>
      <td><button class="table-object inventory-item" type="button" data-action="inventory-product" data-id="${product.sku}">
        ${photo(product)}
        <span><b>${escapeText(product.name)}</b><small>${product.sku} · ${tag(product.group)}</small></span>${icon('chevron',14)}
      </button></td><td><strong>${quantity(units)}</strong></td><td>${num(pallets)}</td><td>${warehouse?location:weight(kg)}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

export function productSheet(row,warehouse) {
  const {product,units,pallets,kg,location,zone,lot}=row;
  const features=[
    ['Единица учёта',product.unit],
    ...(product.unitKg!=null?[['Паспортная масса единицы',num(product.unitKg,3)+' кг']]:[]),
    ...(product.size?[['Габариты единицы',product.size]]:[]),
    ['Условия хранения',product.requirements],
    ...product.characteristics,
  ];
  const facts=[
    ['Количество',quantity(units)],['Палеты',num(pallets)],['Масса партии брутто',weight(kg)],['Номер партии',lot],
    ...(warehouse?[['Зона хранения',zone+' · '+areaName(zone)],['Ячейка',location]]:[]),
  ];
  const list=entries=>`<dl>${entries.map(([name,value])=>`<div><dt>${escapeText(name)}</dt><dd>${escapeText(value)}</dd></div>`).join('')}</dl>`;
  const imageCaption=product.group==='custom'?'Пример упаковки':'Пример внешнего вида';
  return `<button class="btn secondary inventory-back" type="button" data-action="inventory-back">${icon('back',16)} К списку товаров</button>
    <div class="product-intro${productImage(product)?' has-photo':''}">
      ${productImage(product)?`<figure class="product-figure">${photo(product,product.group==='custom'?imageCaption:product.name)}<figcaption>${imageCaption}</figcaption></figure>`:''}
      <div><div class="product-title"><div><span>${tag(product.group)} · ${product.sku}</span><h3>${escapeText(product.name)}</h3></div></div>
      <p class="product-description">${escapeText(product.description)}</p></div>
    </div>
    <div class="product-details"><section><h4>Характеристики</h4>${list(features)}</section><section><h4>${warehouse?'Наличие и размещение':'Партия в рейсе'}</h4>${list(facts)}</section></div>
    ${warehouse?`<button class="btn primary" type="button" data-action="inventory-zone" data-id="${zone}">${icon('locate',16)} Показать зону ${zone} в 3D</button>`:''}`;
}
