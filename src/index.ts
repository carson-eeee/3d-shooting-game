import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';

class ShootingGame {
  private scene: THREE.Scene;
  private playerCamera: THREE.PerspectiveCamera; // First-person camera
  private thirdPersonCamera: THREE.PerspectiveCamera; // Third-person camera
  private activeCamera: THREE.PerspectiveCamera; // Current camera
  private renderer: THREE.WebGLRenderer;
  private player: THREE.Mesh; // Green rectangle player
  private targetEntities: THREE.Mesh[] = []; // Red cube entities
  private bulletEntities: THREE.Mesh[] = []; // Bullet entities
  private blockEntities: THREE.Mesh[] = []; // Block entities
  private yellowEntity: THREE.Mesh | null = null; // Yellow cube entity
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private score: number = 0;
  private scoreElement: HTMLElement;
  private moveSpeed: number = 0.1;
  private bulletSpeed: number = 0.5;
  private gun: THREE.Object3D | undefined;
  private keysPressed: { [key: string]: boolean } = {};
  private isAlive: boolean = true;

  constructor() {
    this.scene = new THREE.Scene();

    // Player as green rectangle
    const playerGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
    const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.player = new THREE.Mesh(playerGeometry, playerMaterial);
    this.player.position.set(0, 1, 0);
    this.scene.add(this.player);

    // Cameras
    this.playerCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.playerCamera.position.copy(this.player.position);
    this.thirdPersonCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.thirdPersonCamera.position.set(0, 5, 5); // Behind and above player
    this.activeCamera = this.playerCamera; // Default to first-person

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(0, 0);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 1, 1).normalize();
    this.scene.add(light);

    this.addGrids();
    this.addGridScale();
    this.spawnInitialTargetEntities();
    this.addGun();
    this.addBlockEntities();

    this.scoreElement = document.createElement('div');
    this.scoreElement.style.position = 'absolute';
    this.scoreElement.style.top = '10px';
    this.scoreElement.style.left = '10px';
    this.scoreElement.style.color = 'white';
    this.scoreElement.style.fontSize = '24px';
    this.scoreElement.style.zIndex = '1000';
    this.scoreElement.innerText = `Score: ${this.score}`;
    document.body.appendChild(this.scoreElement);

    this.addCrosshair();

    this.renderer.domElement.addEventListener('click', this.requestPointerLock.bind(this), false);
    document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    document.addEventListener('click', this.onMouseClick.bind(this), false);
    document.addEventListener('keydown', this.onKeyDown.bind(this), false);
    document.addEventListener('keyup', this.onKeyUp.bind(this), false);
    window.addEventListener('resize', this.onWindowResize.bind(this), false);

    this.animate();
  }

  private addGrids(): void {
    const groundGrid = new THREE.GridHelper(20, 20, 0x00ff00, 0x808080);
    groundGrid.position.set(0, 0, 0);
    this.scene.add(groundGrid);

    const verticalGrid = new THREE.GridHelper(20, 20, 0x0000ff, 0x808080);
    verticalGrid.rotation.z = Math.PI / 2;
    verticalGrid.position.set(0, 0, 0);
    this.scene.add(verticalGrid);
  }

  private addGridScale(): void {
    const loader = new FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
      const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

      for (let x = -10; x <= 10; x++) {
        const textGeometry = new TextGeometry(x.toString(), {
          font: font,
          size: 0.5,
          depth: 0.1,
        });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(x, 0.1, -10);
        this.scene.add(textMesh);
      }

      for (let y = 0; y <= 10; y++) {
        const textGeometry = new TextGeometry(y.toString(), {
          font: font,
          size: 0.5,
          depth: 0.1,
        });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(-10, y, 0);
        textMesh.rotation.y = Math.PI / 2;
        this.scene.add(textMesh);
      }
    });
  }

  private spawnInitialTargetEntities(): void {
    for (let i = 0; i < 5; i++) {
      this.spawnTargetEntity();
    }
  }

  private spawnTargetEntity(): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(geometry, material);
    
    cube.position.set(
      Math.random() * 10 - 5,
      Math.random() * 10,
      Math.random() * -10 - 5
    );
    
    this.scene.add(cube);
    this.targetEntities.push(cube);
  }

  private spawnYellowEntity(): void {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    this.yellowEntity = new THREE.Mesh(geometry, material);
    
    this.yellowEntity.position.set(
      Math.random() * 10 - 5,
      Math.random() * 10,
      Math.random() * -10 - 5
    );
    
    this.scene.add(this.yellowEntity);
    console.log('Yellow cube spawned!');
  }

  private addGun(): void {
    const loader = new FBXLoader();
    console.log('Attempting to load gun.fbx from ./models/gun.fbx');
    loader.load(
      'public\models\gun.fbx',
      (fbx) => {
        this.gun = fbx;
        this.gun.scale.set(0.1, 0.1, 0.1);
        this.gun.position.set(0.2, -0.2, -0.5);
        this.gun.rotation.set(0, 0, 0);
        
        this.playerCamera.add(this.gun); // Attach to first-person camera
        this.scene.add(this.playerCamera);
        console.log('Gun loaded successfully:', this.gun);
      },
      (progress) => {
        console.log(`Loading progress: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
      },
      (error) => {
        console.error('Error loading FBX gun:', error);
        const gunGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 32);
        const gunMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
        this.gun = new THREE.Mesh(gunGeometry, gunMaterial);
        this.gun.position.set(0.2, -0.2, -0.5);
        this.gun.rotation.x = Math.PI / 2;
        this.playerCamera.add(this.gun);
        this.scene.add(this.playerCamera);
        console.log('Fallback gun added');
      }
    );
  }

  private addBlockEntities(): void {
    const blockGeometry = new THREE.BoxGeometry(2, 2, 2);
    const blockMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });

    const blockPositions = [
      new THREE.Vector3(3, 1, -5),
      new THREE.Vector3(-3, 1, -5),
      new THREE.Vector3(0, 3, -10),
    ];

    blockPositions.forEach((pos) => {
      const block = new THREE.Mesh(blockGeometry, blockMaterial);
      block.position.copy(pos);
      this.scene.add(block);
      this.blockEntities.push(block);
      console.log(`Block entity added at: ${pos.x}, ${pos.y}, ${pos.z}`);
    });
  }

  private addCrosshair(): void {
    const crosshair = document.createElement('div');
    crosshair.style.position = 'absolute';
    crosshair.style.width = '20px';
    crosshair.style.height = '20px';
    crosshair.style.left = '50%';
    crosshair.style.top = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.border = '2px solid lime';
    crosshair.style.borderRadius = '50%';
    crosshair.style.pointerEvents = 'none';
    crosshair.style.zIndex = '1000';
    document.body.appendChild(crosshair);
  }

  private requestPointerLock(): void {
    this.renderer.domElement.requestPointerLock();
  }

  private onMouseMove(event: MouseEvent): void {
    if (document.pointerLockElement === this.renderer.domElement) {
      const sensitivity = 0.002;
      this.playerCamera.rotation.y -= event.movementX * sensitivity;
      this.playerCamera.rotation.x -= event.movementY * sensitivity;
      this.playerCamera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.playerCamera.rotation.x));
    }
  }

  private onMouseClick(): void {
    if (document.pointerLockElement === this.renderer.domElement && this.isAlive) {
      this.spawnBulletEntity();
    }
  }

  private spawnBulletEntity(): void {
    const bulletGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    bullet.position.copy(this.gun ? this.gun.getWorldPosition(new THREE.Vector3()) : this.player.position);
    
    const direction = new THREE.Vector3();
    this.playerCamera.getWorldDirection(direction);
    bullet.userData.velocity = direction.clone().multiplyScalar(this.bulletSpeed);
    
    this.scene.add(bullet);
    this.bulletEntities.push(bullet);
  }

  private updateBullets(): void {
    const box = new THREE.Box3();

    for (let i = this.bulletEntities.length - 1; i >= 0; i--) {
      const bullet = this.bulletEntities[i];
      bullet.position.add(bullet.userData.velocity);

      // Red cubes
      for (let j = this.targetEntities.length - 1; j >= 0; j--) {
        const target = this.targetEntities[j];
        box.setFromCenterAndSize(target.position, new THREE.Vector3(1, 1, 1));
        
        if (box.containsPoint(bullet.position)) {
          this.scene.remove(target);
          this.targetEntities.splice(j, 1);
          this.score += 1;
          this.scoreElement.innerText = `Score: ${this.score}`;
          console.log(`Score updated: ${this.score}`);
          if (this.score === 10 && !this.yellowEntity) {
            this.spawnYellowEntity();
          }
          this.spawnTargetEntity();
        }
      }

      // Yellow cube
      if (this.yellowEntity) {
        box.setFromCenterAndSize(this.yellowEntity.position, new THREE.Vector3(1, 1, 1));
        if (box.containsPoint(bullet.position)) {
          this.scene.remove(this.yellowEntity);
          this.yellowEntity = null;
          this.score += 5; // Bonus points
          this.scoreElement.innerText = `Score: ${this.score}`;
          console.log(`Yellow cube destroyed! Score: ${this.score}`);
        }
      }

      // Blue blocks
      for (let k = this.blockEntities.length - 1; k >= 0; k--) {
        const block = this.blockEntities[k];
        box.setFromCenterAndSize(block.position, new THREE.Vector3(2, 2, 2));
        
        if (box.containsPoint(bullet.position)) {
          this.scene.remove(bullet);
          this.bulletEntities.splice(i, 1);
          console.log(`Bullet hit blue block at: ${block.position.x}, ${block.position.y}, ${block.position.z}`);
          break;
        }
      }

      if (this.bulletEntities[i] && bullet.position.z < -50) {
        this.scene.remove(bullet);
        this.bulletEntities.splice(i, 1);
      }
    }

    // Update yellow cube movement
    if (this.yellowEntity) {
      this.yellowEntity.position.x += Math.sin(Date.now() * 0.001) * 0.1; // Oscillate left-right
      this.yellowEntity.position.z += Math.cos(Date.now() * 0.001) * 0.1; // Oscillate forward-back
    }
  }

  private checkCollision(position: THREE.Vector3): { collides: boolean; dies: boolean } {
    const playerSize = 0.5;
    const box = new THREE.Box3();

    for (const block of this.blockEntities) {
      box.setFromCenterAndSize(block.position, new THREE.Vector3(2, 2, 2));
      if (box.containsPoint(position)) {
        return { collides: true, dies: false };
      }
    }

    for (const target of this.targetEntities) {
      box.setFromCenterAndSize(target.position, new THREE.Vector3(1, 1, 1));
      if (box.containsPoint(position)) {
        return { collides: true, dies: true };
      }
    }

    if (this.yellowEntity) {
      box.setFromCenterAndSize(this.yellowEntity.position, new THREE.Vector3(1, 1, 1));
      if (box.containsPoint(position)) {
        return { collides: true, dies: true }; // Yellow cube also kills
      }
    }

    return { collides: false, dies: false };
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.keysPressed[event.key.toLowerCase()] = true;
    if (event.key === 'v' && this.isAlive) { // Toggle view with 'V'
      this.activeCamera = this.activeCamera === this.playerCamera ? this.thirdPersonCamera : this.playerCamera;
      console.log(`Switched to ${this.activeCamera === this.playerCamera ? 'first-person' : 'third-person'} view`);
    }
    console.log(`Key down: ${event.key}`);
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keysPressed[event.key.toLowerCase()] = false;
    console.log(`Key up: ${event.key}`);
  }

  private updatePosition(): void {
    if (!this.isAlive) return;

    const direction = new THREE.Vector3();
    this.playerCamera.getWorldDirection(direction);
    direction.normalize();
    const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    const newPosition = this.player.position.clone();

    if (this.keysPressed['w']) {
      newPosition.addScaledVector(direction, this.moveSpeed);
    }
    if (this.keysPressed['s']) {
      newPosition.addScaledVector(direction, -this.moveSpeed);
    }
    if (this.keysPressed['a']) {
      newPosition.addScaledVector(right, -this.moveSpeed);
    }
    if (this.keysPressed['d']) {
      newPosition.addScaledVector(right, this.moveSpeed);
    }
    if (this.keysPressed[' ']) {
      newPosition.addScaledVector(up, this.moveSpeed);
    }
    if (this.keysPressed['shift']) {
      newPosition.addScaledVector(up, -this.moveSpeed);
    }

    const collision = this.checkCollision(newPosition);
    if (!collision.collides) {
      this.player.position.copy(newPosition);
      this.playerCamera.position.copy(newPosition); // Sync first-person camera
    }
    if (collision.dies) {
      this.isAlive = false;
      console.log('Player died - touched a red or yellow cube!');
      this.scoreElement.innerText = `Game Over! Score: ${this.score}`;
      window.open('https://www.instagram.com/carson_e595/', '_blank'); // Redirect to another site
    }

    // Update third-person camera to follow player
    this.thirdPersonCamera.position.set(
      this.player.position.x,
      this.player.position.y + 5,
      this.player.position.z + 5
    );
    this.thirdPersonCamera.lookAt(this.player.position);
  }

  private onWindowResize(): void {
    this.playerCamera.aspect = window.innerWidth / window.innerHeight;
    this.playerCamera.updateProjectionMatrix();
    this.thirdPersonCamera.aspect = window.innerWidth / window.innerHeight;
    this.thirdPersonCamera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.updatePosition();
    this.updateBullets();
    this.renderer.render(this.scene, this.activeCamera); // Use active camera
  }
}

const game = new ShootingGame();