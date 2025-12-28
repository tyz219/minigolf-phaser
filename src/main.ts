import Phaser from 'phaser'
import './style.css'

class MinigolfScene extends Phaser.Scene {
  private ballBody!: MatterJS.BodyType
  private ballGraphics!: Phaser.GameObjects.Arc
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private spaceKey!: Phaser.Input.Keyboard.Key
  private aimAngle: number = 0 // in Grad, 0 = nach oben
  private power: number = 0.5 // Schlagstärke (0-1)
  private aimLine!: Phaser.GameObjects.Graphics
  private powerBar!: Phaser.GameObjects.Graphics
  private powerBarBg!: Phaser.GameObjects.Rectangle
  private holeSensor!: MatterJS.BodyType
  private isBallMoving: boolean = false
  private hasScored: boolean = false
  private leftButton!: Phaser.GameObjects.Rectangle
  private rightButton!: Phaser.GameObjects.Rectangle
  private powerUpButton!: Phaser.GameObjects.Rectangle
  private powerDownButton!: Phaser.GameObjects.Rectangle
  private hitButton!: Phaser.GameObjects.Rectangle

  constructor() {
    super({ key: 'MinigolfScene' })
  }

  create() {
    const { width, height } = this.scale
    
    // Grüner Rasen-Hintergrund (dunkler)
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a5f1a)
    
    // Matter.js World konfigurieren - keine Schwerkraft
    this.matter.world.setGravity(0, 0)
    
    // Schlüsselloch-Form Bahn erstellen
    const topCenterY = 150
    const topRadius = 150
    const bottomWidth = 200
    const connectionTopY = topCenterY + Math.sqrt(topRadius * topRadius - (bottomWidth / 2) * (bottomWidth / 2))
    
    this.createKeyholeTrack(width, height)
    
    // Loch oben in der Mitte des oberen Kreises
    const holeX = width / 2 - 40 // Gleiche Verschiebung wie Bahn
    const holeY = topCenterY // Mitte des oberen Kreises
    const holeRadius = 30
    
    // Visuelles Loch
    this.add.circle(holeX, holeY, holeRadius, 0x000000)
    
    // Sensor für das Loch (unsichtbar, größer als das sichtbare Loch)
    const holeSensorGameObject = this.matter.add.circle(holeX, holeY, holeRadius + 5, {
      isSensor: true,
      isStatic: true
    } as Phaser.Types.Physics.Matter.MatterBodyConfig)
    this.holeSensor = (holeSensorGameObject as any).body as MatterJS.BodyType
    
    // Ball unten auf der Bahn
    const ballX = width / 2 - 40 // Gleiche Verschiebung wie Bahn
    const ballY = height - 170 // Höher, damit Platz für Buttons
    const ballRadius = 15
    
    // Ball als Matter.js Circle Body
    const body = this.matter.add.circle(ballX, ballY, ballRadius, {
      restitution: 0.9, // Elastizität (hoch für guten Abprall von Wänden)
      friction: 0.0001, // Reibung (sehr gering, damit Ball nicht kleben bleibt)
      frictionAir: 0.001, // Luftreibung (reduziert für längeres Rollen)
      density: 0.001,
      inertia: Infinity // Verhindert Rotation, die Probleme verursachen kann
    } as Phaser.Types.Physics.Matter.MatterBodyConfig)
    this.ballBody = body as any as MatterJS.BodyType
    
    // Visuelle Darstellung des Balls
    this.ballGraphics = this.add.circle(ballX, ballY, ballRadius, 0xFFFFFF, 1)
    this.ballGraphics.setStrokeStyle(2, 0x000000)
    
    // Dreieck-Hindernis: im geraden Teil der Bahn, kurz unterhalb der Verbindung zum oberen Kreis
    // Position: Verbindungsbereich zwischen Kreis und rechteckigem Teil
    // Rotation: 0 Grad (Spitze zeigt nach oben zum Loch)
    const triangleY = connectionTopY + 40 // Kurz unterhalb der Verbindung
    this.createTriangle(width / 2 - 40, triangleY, 50, 0) // Gleiche X-Verschiebung wie Bahn
    
    // Ziellinie (gelb)
    this.aimLine = this.add.graphics()
    
    // Power-Balken vertikal rechts neben der Bahn (0-100%)
    // Position: width * 0.9 (rechts) - sicher links vom HIT-Button (width * 0.8)
    const barWidth = 20
    const barHeight = 300
    const barX = width * 0.9 // Rechts, aber sicher links vom HIT-Button
    const barY = height - 200 // Über den Buttons
    
    // Hintergrund des Balkens
    this.powerBarBg = this.add.rectangle(
      barX,
      barY,
      barWidth,
      barHeight,
      0x333333,
      1
    )
    this.powerBarBg.setStrokeStyle(2, 0x000000)
    
    // Power-Balken (Graphic für dynamisches Update)
    this.powerBar = this.add.graphics()
    
    // Mobile-Steuerung erstellen
    this.createMobileControls(width, height)
    
    // Tastatur-Input (für Desktop)
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    
    // Kollisions-Event für das Loch
    this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      event.pairs.forEach((pair: any) => {
        const bodyA = pair.bodyA
        const bodyB = pair.bodyB
        
        // Prüfe ob Ball und Loch-Sensor kollidieren
        const ballBody = this.ballBody as any
        const holeBody = this.holeSensor as any
        
        if ((bodyA === holeBody || bodyB === holeBody) &&
            (bodyA === ballBody || bodyB === ballBody)) {
          
          const velocity = Math.sqrt(ballBody.velocity.x ** 2 + ballBody.velocity.y ** 2)
          
          // Ball fällt ins Loch wenn langsam genug
          if (velocity < 2 && !this.hasScored) {
            this.hasScored = true
            this.ballGraphics.setVisible(false)
            if (this.ballBody) {
              this.matter.world.remove(this.ballBody)
            }
            this.aimLine.clear()
            this.powerBar.clear()
            
            // Erfolgs-Nachricht
            const text = this.add.text(width / 2, height / 2, 'LOCH!', {
              fontSize: '48px',
              color: '#FFFFFF',
              fontStyle: 'bold'
            })
            text.setOrigin(0.5)
            text.setStroke('#000000', 4)
          }
        }
      })
    })
  }
  
  createKeyholeTrack(width: number, height: number) {
    const trackX = width / 2 - 40 // Etwas nach links, damit Platz rechts für Power-Balken
    const bottomWidth = 200
    const topRadius = 150
    const wallThickness = 20
    
    // Unten: Rechteckige Form - höher, damit Platz für Buttons
    const bottomY = height - 120 // Höher, damit Platz für Buttons unten
    const bottomLeftX = trackX - bottomWidth / 2
    const bottomRightX = trackX + bottomWidth / 2
    
    // Oben: Runde Fläche
    const topCenterY = 150
    const connectionTopY = topCenterY + Math.sqrt(topRadius * topRadius - (bottomWidth / 2) * (bottomWidth / 2))
    
    // Bahn-Fläche visuell darstellen (helleres Grün)
    const trackGraphics = this.add.graphics()
    trackGraphics.fillStyle(0x32CD32, 1) // Helles Grün für die Bahn
    
    trackGraphics.fillCircle(trackX, topCenterY, topRadius)
    
    // Unten: Rechteckige Fläche
    trackGraphics.fillRect(
      bottomLeftX,
      bottomY - 150,
      bottomWidth,
      150
    )
    
    // Verbindung zwischen oben und unten - nahtloser Übergang
    // Der obere Kreis sollte nahtlos in die rechteckige Bahn übergehen
    const connectionBottomY = bottomY - 150
    trackGraphics.fillRect(
      bottomLeftX,
      connectionTopY,
      bottomWidth,
      connectionBottomY - connectionTopY
    )
    
    // Linke Wand unten (Physik + Visual)
    this.matter.add.rectangle(
      bottomLeftX - wallThickness / 2,
      bottomY - 150,
      wallThickness,
      300,
      { isStatic: true, restitution: 0.9, friction: 0 }
    )
    this.add.rectangle(
      bottomLeftX - wallThickness / 2,
      bottomY - 150,
      wallThickness,
      300,
      0x8B4513,
      1
    ).setStrokeStyle(2, 0x654321)
    
    // Rechte Wand unten (Physik + Visual)
    this.matter.add.rectangle(
      bottomRightX + wallThickness / 2,
      bottomY - 150,
      wallThickness,
      300,
      { isStatic: true, restitution: 0.9, friction: 0 }
    )
    this.add.rectangle(
      bottomRightX + wallThickness / 2,
      bottomY - 150,
      wallThickness,
      300,
      0x8B4513,
      1
    ).setStrokeStyle(2, 0x654321)
    
    // Boden unten (Physik + Visual)
    this.matter.add.rectangle(
      trackX,
      bottomY + wallThickness / 2,
      bottomWidth + wallThickness * 2,
      wallThickness,
      { isStatic: true, restitution: 0.9, friction: 0 }
    )
    this.add.rectangle(
      trackX,
      bottomY + wallThickness / 2,
      bottomWidth + wallThickness * 2,
      wallThickness,
      0x8B4513,
      1
    ).setStrokeStyle(2, 0x654321)
    
    // Oben: Runde Wand
    const topCenterX = trackX
    const segments = 40
    const angleStep = (Math.PI * 2) / segments
    
    // Graphics für die obere Wand
    const topWallGraphics = this.add.graphics()
    topWallGraphics.fillStyle(0x8B4513, 1)
    topWallGraphics.lineStyle(2, 0x654321)
    
    for (let i = 0; i < segments; i++) {
      const angle1 = i * angleStep
      const angle2 = (i + 1) * angleStep
      
      // Überspringe den oberen Bereich (wo das Loch ist) - etwa 60 Grad
      const midAngle = (angle1 + angle2) / 2
      const angleFromTop = Math.abs(midAngle - Math.PI / 2)
      if (angleFromTop < Math.PI / 6) {
        continue
      }
      
      const x1 = topCenterX + Math.cos(angle1) * topRadius
      const y1 = topCenterY + Math.sin(angle1) * topRadius
      const x2 = topCenterX + Math.cos(angle2) * topRadius
      const y2 = topCenterY + Math.sin(angle2) * topRadius
      
      // Überspringe den unteren Bereich, wo der gerade Teil anfängt (Überlappung vermeiden)
      const minY = Math.min(y1, y2)
      if (minY > connectionTopY) {
        continue
      }
      
      // Erstelle ein Rechteck als Wandsegment
      const segmentX = (x1 + x2) / 2
      const segmentY = (y1 + y2) / 2
      const segmentLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      const segmentAngle = Math.atan2(y2 - y1, x2 - x1)
      
      // Erstelle Rechteck mit Rotation
      const vertices = [
        { x: -segmentLength / 2, y: -wallThickness / 2 },
        { x: segmentLength / 2, y: -wallThickness / 2 },
        { x: segmentLength / 2, y: wallThickness / 2 },
        { x: -segmentLength / 2, y: wallThickness / 2 }
      ]
      
      const rotatedVertices = vertices.map(v => ({
        x: v.x * Math.cos(segmentAngle) - v.y * Math.sin(segmentAngle) + segmentX,
        y: v.x * Math.sin(segmentAngle) + v.y * Math.cos(segmentAngle) + segmentY
      }))
      
      // Physik-Body
      this.matter.add.rectangle(
        segmentX,
        segmentY,
        segmentLength,
        wallThickness,
        { isStatic: true, restitution: 0.9, friction: 0 }
      )
      
      // Visuelle Darstellung als Polygon
      topWallGraphics.beginPath()
      topWallGraphics.moveTo(rotatedVertices[0].x, rotatedVertices[0].y)
      topWallGraphics.lineTo(rotatedVertices[1].x, rotatedVertices[1].y)
      topWallGraphics.lineTo(rotatedVertices[2].x, rotatedVertices[2].y)
      topWallGraphics.lineTo(rotatedVertices[3].x, rotatedVertices[3].y)
      topWallGraphics.closePath()
      topWallGraphics.fillPath()
      topWallGraphics.strokePath()
    }
    
    // Verbindungswände zwischen unten und oben
    const connectionHeight = connectionBottomY - connectionTopY
    
    // Linke Verbindungswand (Physik + Visual)
    this.matter.add.rectangle(
      bottomLeftX - wallThickness / 2,
      (connectionTopY + connectionBottomY) / 2,
      wallThickness,
      connectionHeight,
      { isStatic: true, restitution: 0.9, friction: 0 }
    )
    this.add.rectangle(
      bottomLeftX - wallThickness / 2,
      (connectionTopY + connectionBottomY) / 2,
      wallThickness,
      connectionHeight,
      0x8B4513,
      1
    ).setStrokeStyle(2, 0x654321)
    
    // Rechte Verbindungswand (Physik + Visual)
    this.matter.add.rectangle(
      bottomRightX + wallThickness / 2,
      (connectionTopY + connectionBottomY) / 2,
      wallThickness,
      connectionHeight,
      { isStatic: true, restitution: 0.9, friction: 0 }
    )
    this.add.rectangle(
      bottomRightX + wallThickness / 2,
      (connectionTopY + connectionBottomY) / 2,
      wallThickness,
      connectionHeight,
      0x8B4513,
      1
    ).setStrokeStyle(2, 0x654321)
  }
  
  createMobileControls(width: number, height: number) {
    // Touch-Zonen: großzügig (75px) für bessere Ergonomie
    const buttonSize = 75
    const buttonY = height - 45 // Weiter unten, damit keine Überlappung mit Bahn
    const hitButtonWidth = 120
    const hitButtonHeight = 75
    
    // === LINKS UNTEN: Pfeiltasten (Zielen) ===
    // Position: width * 0.2 (relativ, links)
    const leftSectionX = width * 0.2
    const arrowSpacing = 90 // Abstand zwischen Pfeilen
    
    // Linke Pfeil-Button (Richtung links)
    this.leftButton = this.add.rectangle(
      leftSectionX - arrowSpacing / 2,
      buttonY,
      buttonSize,
      buttonSize,
      0x888888,
      0.8
    )
    this.leftButton.setStrokeStyle(3, 0x000000)
    this.leftButton.setInteractive({ useHandCursor: true })
    
    const leftArrow = this.add.text(
      leftSectionX - arrowSpacing / 2,
      buttonY,
      '←',
      { fontSize: '42px', color: '#FFFFFF', fontStyle: 'bold' }
    )
    leftArrow.setOrigin(0.5)
    
    this.leftButton.on('pointerdown', () => {
      if (!this.isBallMoving && this.ballBody) {
        this.aimAngle -= 2
      }
    })
    
    // Rechte Pfeil-Button (Richtung rechts)
    this.rightButton = this.add.rectangle(
      leftSectionX + arrowSpacing / 2,
      buttonY,
      buttonSize,
      buttonSize,
      0x888888,
      0.8
    )
    this.rightButton.setStrokeStyle(3, 0x000000)
    this.rightButton.setInteractive({ useHandCursor: true })
    
    const rightArrow = this.add.text(
      leftSectionX + arrowSpacing / 2,
      buttonY,
      '→',
      { fontSize: '42px', color: '#FFFFFF', fontStyle: 'bold' }
    )
    rightArrow.setOrigin(0.5)
    
    this.rightButton.on('pointerdown', () => {
      if (!this.isBallMoving && this.ballBody) {
        this.aimAngle += 2
      }
    })
    
    // === MITTE UNTEN: Power-Buttons ===
    // Position: width * 0.5 (relativ, zentriert)
    const centerX = width * 0.5
    const powerButtonSpacing = 90 // Abstand zwischen + und -
    
    // Minus-Button (Stärke reduzieren)
    this.powerDownButton = this.add.rectangle(
      centerX - powerButtonSpacing / 2,
      buttonY,
      buttonSize,
      buttonSize,
      0x888888,
      0.8
    )
    this.powerDownButton.setStrokeStyle(3, 0x000000)
    this.powerDownButton.setInteractive({ useHandCursor: true })
    
    const minusText = this.add.text(
      centerX - powerButtonSpacing / 2,
      buttonY,
      '−',
      { fontSize: '52px', color: '#FFFFFF', fontStyle: 'bold' }
    )
    minusText.setOrigin(0.5)
    
    this.powerDownButton.on('pointerdown', () => {
      if (!this.isBallMoving && this.ballBody) {
        this.power = Phaser.Math.Clamp(this.power - 0.05, 0.1, 1.0)
      }
    })
    
    // Plus-Button (Stärke erhöhen)
    this.powerUpButton = this.add.rectangle(
      centerX + powerButtonSpacing / 2,
      buttonY,
      buttonSize,
      buttonSize,
      0x888888,
      0.8
    )
    this.powerUpButton.setStrokeStyle(3, 0x000000)
    this.powerUpButton.setInteractive({ useHandCursor: true })
    
    const plusText = this.add.text(
      centerX + powerButtonSpacing / 2,
      buttonY,
      '+',
      { fontSize: '52px', color: '#FFFFFF', fontStyle: 'bold' }
    )
    plusText.setOrigin(0.5)
    
    this.powerUpButton.on('pointerdown', () => {
      if (!this.isBallMoving && this.ballBody) {
        this.power = Phaser.Math.Clamp(this.power + 0.05, 0.1, 1.0)
      }
    })
    
    // === RECHTS UNTEN: HIT-Button ===
    // Position: width * 0.8 (relativ, rechts) - sicher Abstand zur Power-Leiste
    const hitButtonX = width * 0.8
    this.hitButton = this.add.rectangle(
      hitButtonX,
      buttonY,
      hitButtonWidth,
      hitButtonHeight,
      0xFF0000,
      0.9
    )
    this.hitButton.setStrokeStyle(4, 0x000000)
    this.hitButton.setInteractive({ useHandCursor: true })
    
    const hitText = this.add.text(
      hitButtonX,
      buttonY,
      'HIT',
      { fontSize: '36px', color: '#FFFFFF', fontStyle: 'bold' }
    )
    hitText.setOrigin(0.5)
    hitText.setStroke('#000000', 2)
    
    this.hitButton.on('pointerdown', () => {
      if (!this.isBallMoving && this.ballBody) {
        const body = this.ballBody as any
        const angleRad = Phaser.Math.DegToRad(this.aimAngle - 90)
        const force = this.power * 0.08
        const forceX = Math.cos(angleRad) * force
        const forceY = Math.sin(angleRad) * force
        
        this.matter.body.applyForce(this.ballBody, body.position, { x: forceX, y: forceY })
      }
    })
  }
  
  createTriangle(x: number, y: number, radius: number, angle: number) {
    const angleRad = Phaser.Math.DegToRad(angle)
    
    // Erstelle Polygon-Body mit isStatic: true und korrekter Rotation
    const polygonBody = this.matter.add.polygon(
      x,
      y,
      3, // 3 Seiten
      radius,
      {
        isStatic: true,
        restitution: 0.9,
        friction: 0,
        angle: angleRad
      }
    ) as any
    
    // Hole den Body und seine Vertices
    const body = (polygonBody as any).body as MatterJS.BodyType
    
    // Visuelle Darstellung mit Graphics - verwende die tatsächlichen Body-Vertices
    const graphics = this.add.graphics()
    graphics.fillStyle(0xFF6B6B, 1) // Rot
    graphics.beginPath()
    
    // Zeichne das Dreieck mit den Body-Vertices (die bereits rotiert sind)
    if (body && body.vertices && body.vertices.length > 0) {
      graphics.moveTo(body.vertices[0].x, body.vertices[0].y)
      for (let i = 1; i < body.vertices.length; i++) {
        graphics.lineTo(body.vertices[i].x, body.vertices[i].y)
      }
      graphics.closePath()
    }
    graphics.fillPath()
    
    // Schwarzer Rand
    graphics.lineStyle(2, 0x000000)
    graphics.strokePath()
  }
  
  update() {
    // Synchronisiere Ball-Grafik mit Physik-Body
    if (this.ballBody && this.ballGraphics && !this.hasScored) {
      const body = this.ballBody as any
      this.ballGraphics.x = body.position.x
      this.ballGraphics.y = body.position.y
    }
    
    if (this.hasScored) return
    
    // Prüfe ob Ball stillsteht
    if (this.ballBody) {
      const body = this.ballBody as any
      const velocity = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2)
      this.isBallMoving = velocity > 0.1
      
      // Dämpfe Ball leicht ab (deutlich weniger Dämpfung für längeres Rollen)
      if (this.isBallMoving) {
        this.matter.body.setVelocity(this.ballBody, {
          x: body.velocity.x * 0.995,
          y: body.velocity.y * 0.995
        })
        this.aimLine.clear()
      }
    }
    
    // Steuerung nur wenn Ball stillsteht
    if (!this.isBallMoving && this.ballBody) {
      // Richtung ändern (links/rechts)
      if (this.cursors.left?.isDown) {
        this.aimAngle -= 2
      }
      if (this.cursors.right?.isDown) {
        this.aimAngle += 2
      }
      
      // Stärke ändern (hoch/runter)
      if (this.cursors.up?.isDown) {
        this.power = Phaser.Math.Clamp(this.power + 0.01, 0.1, 1.0)
      }
      if (this.cursors.down?.isDown) {
        this.power = Phaser.Math.Clamp(this.power - 0.01, 0.1, 1.0)
      }
      
      // Power-Balken aktualisieren (vertikal rechts neben der Bahn)
      // Position: width * 0.9 (rechts) - sicher links vom HIT-Button (width * 0.8)
      this.powerBar.clear()
      const barWidth = 20
      const barHeight = 300
      const barX = this.scale.width * 0.9 // Rechts, aber sicher links vom HIT-Button
      const barY = this.scale.height - 200 // Über den Buttons
      
      this.powerBar.fillStyle(0x00FF00, 1) // Grün
      const currentPowerHeight = barHeight * this.power
      const currentPowerY = barY - barHeight / 2 + (barHeight - currentPowerHeight) // Von unten nach oben füllen
      
      this.powerBar.fillRect(barX - barWidth / 2, currentPowerY, barWidth, currentPowerHeight)
      
      // Skala (0-100%) - Markierungen horizontal
      this.powerBar.lineStyle(1, 0x000000, 0.5)
      for (let i = 0; i <= 10; i++) {
        const y = barY - barHeight / 2 + (barHeight / 10) * i
        this.powerBar.lineBetween(barX - barWidth / 2, y, barX + barWidth / 2, y)
      }
      
      // Ziellinie zeichnen (gelb)
      this.aimLine.clear()
      this.aimLine.lineStyle(4, 0xFFFF00, 1)
      
      const body = this.ballBody as any
      const startX = body.position.x
      const startY = body.position.y
      
      const angleRad = Phaser.Math.DegToRad(this.aimAngle - 90) // -90 weil 0° nach oben zeigen soll
      const lineLength = 50 // Kurzer Pfeil, feste Länge (halbe Länge wie vorher bei 0)
      const endX = startX + Math.cos(angleRad) * lineLength
      const endY = startY + Math.sin(angleRad) * lineLength
      
      this.aimLine.lineBetween(startX, startY, endX, endY)
      
      // Pfeilspitze
      const arrowSize = 15
      const arrowAngle1 = angleRad + Math.PI - Math.PI / 6
      const arrowAngle2 = angleRad + Math.PI + Math.PI / 6
      
      this.aimLine.lineBetween(
        endX,
        endY,
        endX + Math.cos(arrowAngle1) * arrowSize,
        endY + Math.sin(arrowAngle1) * arrowSize
      )
      this.aimLine.lineBetween(
        endX,
        endY,
        endX + Math.cos(arrowAngle2) * arrowSize,
        endY + Math.sin(arrowAngle2) * arrowSize
      )
      
      // Schlag ausführen (Space)
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        // Deutlich erhöhte Kraft: bei 50% sollte es zum Loch reichen, bei 100% deutlich abprallen
        const force = this.power * 0.08
        const forceX = Math.cos(angleRad) * force
        const forceY = Math.sin(angleRad) * force
        
        this.matter.body.applyForce(this.ballBody, body.position, { x: forceX, y: forceY })
      }
    }
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 900,
  parent: 'app',
  backgroundColor: '#228B22',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0 },
      debug: true
    }
  },
  scene: MinigolfScene
}

new Phaser.Game(config)