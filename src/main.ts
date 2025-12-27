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
    const holeX = width / 2
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
    const ballX = width / 2
    const ballY = height - 100
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
    
    // Dreieck-Hindernis: kurz unterhalb des Kreises, Spitze nach oben
    this.createTriangle(width / 2, connectionTopY + 60, 50, 0)
    
    // Ziellinie (gelb)
    this.aimLine = this.add.graphics()
    
    // Power-Balken unter der Bahn (0-100%)
    const barWidth = 300
    const barHeight = 20
    const barY = height - 20
    
    // Hintergrund des Balkens
    this.powerBarBg = this.add.rectangle(
      width / 2,
      barY,
      barWidth,
      barHeight,
      0x333333,
      1
    )
    this.powerBarBg.setStrokeStyle(2, 0x000000)
    
    // Power-Balken (Graphic für dynamisches Update)
    this.powerBar = this.add.graphics()
    
    // Tastatur-Input
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
    const trackX = width / 2
    const bottomWidth = 200
    const topRadius = 150
    const wallThickness = 20
    
    // Unten: Rechteckige Form
    const bottomY = height - 50
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
      
      // Power-Balken aktualisieren
      this.powerBar.clear()
      const barWidth = 300
      const barHeight = 20
      const barX = this.scale.width / 2 - barWidth / 2
      const barY = this.scale.height - 20
      const powerWidth = barWidth * this.power
      
      this.powerBar.fillStyle(0x00FF00, 1) // Grün für Power
      this.powerBar.fillRect(barX, barY - barHeight / 2, powerWidth, barHeight)
      
      // Prozentanzeige
      this.powerBar.lineStyle(1, 0xFFFFFF, 1)
      for (let i = 0; i <= 10; i++) {
        const x = barX + (barWidth / 10) * i
        this.powerBar.lineBetween(x, barY - barHeight / 2, x, barY + barHeight / 2)
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