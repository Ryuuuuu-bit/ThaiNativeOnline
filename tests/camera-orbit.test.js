import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CameraController} from '../src/core/CameraController.js';
import {fadeUniforms} from '../src/world/shaders.js';
const make=()=>new CameraController({setSize(){},getPixelRatio:()=>1},{clientWidth:1366,clientHeight:768,getBoundingClientRect:()=>({left:0,top:0,width:1366,height:768})});
test('orbit preserves 2.5D pitch and radius; movement and fading follow view',()=>{
 const v=make(),distance=v.offset.length(),height=v.offset.y;
 v.orbit(400,v.yaw);
 assert.ok(Math.abs(v.offset.length()-distance)<1e-9);assert.equal(v.offset.y,height);
 assert.ok(Math.abs(v.forward.dot(v.right))<1e-9);
 assert.ok(v.forward.distanceTo(v.offset.clone().setY(0).normalize().negate())<1e-9);
 assert.ok(fadeUniforms.uFadeDir.value.distanceTo(v.offset.clone().normalize())<1e-9);
 const target=new THREE.Vector3(4,0,150);v.snap(target);v.camera.updateMatrixWorld();
 assert.ok(v.groundPoint(683,384,()=>0).distanceTo(target)<1e-7,'center click still targets player ground');
 assert.ok(v.groundFootprint().every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
});
test('movement recenter retains heading; reset restores original view and zoom',()=>{
 const v=make(),initial=v.offset.clone();v.orbit(800,v.yaw);const yaw=v.yaw;
 v.pan(80,50,v.panOffset.clone());v.recenter();assert.equal(v.yaw,yaw);assert.equal(v.panOffset.length(),0);
 v.setZoom(2);v.reset();assert.ok(v.offset.distanceTo(initial)<1e-9);assert.equal(v.zoom,1);
});
