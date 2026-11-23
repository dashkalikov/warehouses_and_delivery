import assert from 'node:assert/strict';
import {test} from 'node:test';
import {warehouses, fleet} from '../app/data.mjs';
import { existsSync } from 'node:fs';
import { cargoPreview, inventoryRows, productSheet } from '../app/inventory-ui.mjs';
import { productImage } from '../app/product-images.mjs';
import * as camera from '../app/camera-motion.mjs';

test('warehouse totals reconcile with group quantities, SKUs and pallet locations',async()=>{
  const {stockFor,inventorySummary}=await import('../app/inventory.mjs');
  for(const site of warehouses) {
    const stock=stockFor(site);
    const summary=inventorySummary(stock);
    assert.ok(summary.groups.length>=3,site.id);
    assert.equal(summary.skus,new Set(stock.map(row=>row.product.sku)).size);
    assert.equal(summary.units,summary.groups.reduce((sum,row)=>sum+row.units,0));
    assert.ok(stock.every(row=>row.units>0&&row.zone&&row.product.description&&row.product.size),site.id);
  }
});

test('a vehicle manifest reconciles gross mass and pallets with the shipment',async()=>{
  const {manifestFor,inventorySummary}=await import('../app/inventory.mjs');
  const trip={load:14,pallets:22,goods:'Комплектующие'};
  const rows=manifestFor(fleet[0],trip);
  const summary=inventorySummary(rows);
  assert.ok(rows.length>=2);
  assert.equal(summary.kg,14000);
  assert.equal(summary.pallets,22);
  assert.ok(rows.every(row=>row.units>0&&row.product.unitKg*row.units<=row.kg+1e-8));
  assert.deepEqual(manifestFor(fleet[0],null),[]);
});

test('a custom cargo description is retained and its package count stays meaningful',async()=>{
  const {manifestFor,inventorySummary}=await import('../app/inventory.mjs');
  const trip={load:.1,pallets:17,goods:'Части нестандартного станка'};
  const rows=manifestFor(fleet[0],trip);
  const summary=inventorySummary(rows);
  assert.equal(rows[0].product.name,trip.goods);
  assert.equal(summary.units,17);
  assert.equal(summary.kg,100);
});

test('every catalog product resolves to a distinct picture from a local atlas',async()=>{
  const {stockFor}=await import('../app/inventory.mjs');
  const products=new Map(warehouses.flatMap(stockFor).map(row=>[row.product.sku,row.product]));
  const pictures=new Set();
  for(const product of products.values()) {
    const picture=productImage(product);
    assert.ok(existsSync(new URL('../app'+picture.src,import.meta.url)),product.sku);
    pictures.add(JSON.stringify(picture));
  }
  assert.equal(pictures.size,products.size);
  assert.equal(productImage({sku:'unknown',group:'parts'}),null);
});

test('uncovered cargo shows its manifest photos and distinguishes unknown or delivered goods',async()=>{
  const {manifestFor}=await import('../app/inventory.mjs');
  const rows=manifestFor(fleet[0],{load:2,pallets:8,goods:'Комплектующие'});
  const preview=cargoPreview(rows,'active');
  for(const {product} of rows) assert.ok(preview.includes(`data-id="${product.sku}"`));
  assert.match(preview,/\/assets\/cargo\/mechanical\.webp/);
  assert.match(inventoryRows(rows,false),/product-photo/);
  assert.match(productSheet(rows[0],false),/Пример внешнего вида/);
  assert.doesNotMatch(cargoPreview(rows,'done'),/product-photo/);
  assert.match(cargoPreview([],'reserve'),/Кузов пуст/);
  const [custom]=manifestFor(fleet[0],{load:.1,pallets:2,goods:'Станок по заказу'});
  assert.match(productSheet(custom,false),/Пример упаковки/);
});

test('a vertical camera has a well-defined orientation',()=>{
  const yaw=Math.PI/2, pitch=Math.PI/2;
  const {direction,up}=camera.cameraBasis(yaw,pitch);
  assert.ok(Math.abs(direction[0])<1e-10&&Math.abs(direction[2])<1e-10);
  assert.equal(direction[1],1);
  assert.ok(Math.abs(up[0]+1)<1e-10);
  assert.ok(Math.abs(direction.reduce((sum,x,i)=>sum+x*up[i],0))<1e-10);
});

test('a top view keeps the same scale and fits the footprint throughout a turn',()=>{
  for(const [width,depth] of [[40.4,30.1],[19.05,4.91]]) {
    for(const aspect of [.7,2]) {
      const half=camera.planFrameHalf(width,depth,aspect,0);
      for(let step=0;step<36;step++) {
        const yaw=step*Math.PI/18;
        assert.equal(camera.planFrameHalf(width,depth,aspect,yaw),half);
        const a=Math.abs(Math.cos(yaw)), b=Math.abs(Math.sin(yaw));
        assert.ok((width*b+depth*a)/2<=half);
        assert.ok((width*a+depth*b)/2<=half*aspect);
      }
    }
  }
});
