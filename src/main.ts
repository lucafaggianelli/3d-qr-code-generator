import * as THREE from 'three'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter'

import './main.css'
import qrcodegen from './qrcodegen'

const barcodeSizeMm = 80
const baseThicknessMm = 5
const qrThicknessMm = 2
const qrBorderMm = 5

const generateQrCode = (qrContent: string) => {
  const errCorLvl = qrcodegen.QrCode.Ecc.LOW

  return qrcodegen.QrCode.encodeText(qrContent, errCorLvl)
}

// Draws the given QR Code, with the given module scale and border modules, onto the given HTML
// canvas element. The canvas's width and height is resized to (qr.size + border * 2) * scale.
// The drawn image is purely dark and light, and fully opaque.
// The scale must be a positive integer and the border must be a non-negative integer.
const drawCanvas = (qr: any, scale: number, border: number, lightColor: string, darkColor: string, canvas: HTMLCanvasElement) => {
  if (scale <= 0 || border < 0)
    throw new RangeError("Value out of range");

  const width = (qr.size + border * 2) * scale;
  canvas.width = width;
  canvas.height = width;

  let ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Canvas has no 2D context")
  }

  for (let y = -border; y < qr.size + border; y++) {
    for (let x = -border; x < qr.size + border; x++) {
      ctx.fillStyle = qr.getModule(x, y) ? darkColor : lightColor;
      ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
    }
  }
}

class ThreeDScene {
  // Main scene infrastructure
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.Renderer
  controls: TrackballControls

  /**
   * Group containing all the objects forming a QR code
   */
  qrGroup: THREE.Group

  constructor () {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xEEEEEE);

    this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    this.renderer = new THREE.WebGLRenderer()

    this.renderer.setSize( window.innerWidth, window.innerHeight )
    document.body.appendChild( this.renderer.domElement )

    const light = new THREE.PointLight()
    light.position.set(0, 0, barcodeSizeMm);
    this.scene.add( light );

    this.camera.position.z = barcodeSizeMm / 1.2
    this.camera.position.y = -barcodeSizeMm / 1.5

    this.controls = new TrackballControls( this.camera, this.renderer.domElement )
    this.setupControls()

    this.qrGroup = new THREE.Group()
  }

  drawBarcodeModule (x: number, y: number, size: number, thickness: number) {
    const geometry = new THREE.BoxGeometry(size, size, thickness)

    const material = new THREE.MeshPhongMaterial({ color: 0x404040 })
    const cube = new THREE.Mesh(geometry, material)
    cube.position.set(x, -y, thickness / 2)

    this.qrGroup.add(cube)
  }

  drawBarcodeBackground (height: number, width: number, thickness: number) {
    const geometry = new THREE.BoxGeometry(height, width, thickness)

    const material = new THREE.MeshPhongMaterial({ color: 0xffffff })
    const cube = new THREE.Mesh(geometry, material)
    cube.position.set(0, 0, - thickness / 2)

    this.qrGroup.add(cube)
  }

  drawBarcode (qr: any, border: number) {
    if (border <= 0) {
      throw new RangeError("Value out of range")
    }

    this.scene.remove(this.qrGroup)
    this.qrGroup = new THREE.Group()
    this.scene.add(this.qrGroup)

    const scale = barcodeSizeMm / qr.size

    const barcodeSize = qr.size * scale

    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.getModule(x, y)) {
          this.drawBarcodeModule(
            x * scale - barcodeSize / 2 + scale / 2,
            y * scale - barcodeSize / 2 + scale / 2,
            scale,
            qrThicknessMm
          )
        }
      }
    }

    this.drawBarcodeBackground(
      barcodeSizeMm + border * 2,
      barcodeSizeMm + border * 2,
      baseThicknessMm
    )
  }

  setupControls () {
    this.controls.rotateSpeed = 10;
    this.controls.zoomSpeed = 4;
    this.controls.panSpeed = 0.8;
  }

  onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;

    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()

    this.renderer.setSize( window.innerWidth, window.innerHeight );

    this.controls.handleResize();
  }

  exportAsSTL () {
    const exporter = new STLExporter()

    const result = exporter.parse( this.scene, { binary: true } )
		this.saveArrayBuffer(result, 'QR Code.stl')
  }

  save(blob: Blob, filename: string) {
    const link = document.createElement( 'a' )
    link.style.display = 'none'
    document.body.appendChild(link)

    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()

    link.remove()
  }

  saveString(text: string, filename: string) {
    this.save( new Blob( [ text ], { type: 'text/plain' } ), filename )
  }

  saveArrayBuffer(buffer: string, filename: string) {
    this.save( new Blob( [ buffer ], { type: 'application/octet-stream' } ), filename )
  }

  animate () {
    requestAnimationFrame(this.animate.bind(this))

    this.renderer.render(this.scene, this.camera)
    this.controls.update()
  }
}

const getWifiEasyConnectUri = (data: FormData) => {
  const parts = [
    `S:${data.get('ssid')}`
  ]

  if ((data.get('security') || 'none') !== 'none') {
    parts.push(`T:${data.get('security')}`)
    parts.push(`P:${data.get('password')}`)
  }

  if (data.get('hidden')) {
    parts.push(`H:true`)
  }

  return `WIFI:${parts.join(';')}`
}

const main = () => {
  const qr = generateQrCode("Hello World")

  // drawCanvas(qr, 10, 4, "#FFFFFF", "#000000", document.getElementById('qr-code'))

  const barcodeScene = new ThreeDScene()
  barcodeScene.animate()
  barcodeScene.drawBarcode(qr, qrBorderMm)

  const button = document.getElementById('export')
  button!.addEventListener('click', () => barcodeScene.exportAsSTL())

  const form = document.getElementById('main-navbar')
  form!.addEventListener('submit', (event) => {
    event.preventDefault()

    const data = new FormData(form as HTMLFormElement)

    if (!data.has('security')) {
      data.set('security', 'WPA')
    }

    const content = getWifiEasyConnectUri(data)
    console.log(content)
    const qr = generateQrCode(content)

    barcodeScene.drawBarcode(qr, qrBorderMm)
  })
}

main()
