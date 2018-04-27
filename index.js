
class Karplus {

    constructor () {
        this.audioContext = new window.AudioContext();

        // gain node
        this.gainNode = this.audioContext.createGain();

        this.analyser = this.audioContext.createAnalyser();

        // volume element
        this.volumeElement = document.getElementById("volume");
        this.volumeElement.addEventListener("input", () => this.updateVolume());
        this.updateVolume();

        // note frequencies here: http://makaroni4.com/images/posts/guitar_bro/guitar_frequencies.jpg
        const G_CHORD = this.makeChord(98, 123, 147, 196, 294, 392);
        const A_CHORD = this.makeChord(110, 165, 220, 277, 329);
        const D_CHORD = this.makeChord(147, 220, 294, 370);

        this.nodes = [
            D_CHORD,
            // this.makeKarplusStrongNode(220),
            this.makeFilter("lowshelf", 600, 15),  // increase this frequency to make lower pitches louder
            this.makeFilter("peaking", 220, 5),
            this.makeFilter("highshelf", 2500, -15),
            this.gainNode,
            this.analyser,
            this.audioContext.destination,
        ];

        // connect nodes in series
        this.nodes.forEach((nodeStage, index) => {
            if (index !== this.nodes.length - 1) {
                const nextNode = this.nodes[index + 1];
                if (Array.isArray(nodeStage)) {
                    for (const node of nodeStage) {
                        node.connect(nextNode);
                    }
                } else {
                    nodeStage.connect(nextNode);
                }
            }
        });

        this.canvasCtx = document.getElementById("display").getContext("2d");
        this.canvasWidth = 1024;
        this.canvasHeight = 160;

        this.analyser.fftSize = 4096;
        this.analyserBufferLength = this.analyser.frequencyBinCount;
        this.analyserData = new Uint8Array(this.analyserBufferLength);
        this.analyserBarWidth = (this.canvasWidth / this.analyserBufferLength);
        this.draw();
    }

    draw() {
        this.analyser.getByteFrequencyData(this.analyserData);

        this.canvasCtx.fillStyle = "black";
        this.canvasCtx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        let x = 0;
        for (let i = 0; i < this.analyserBufferLength; i++) {
            let barHeight = this.analyserData[i];
            this.canvasCtx.fillStyle = `rgb(255, 50, 50)`;
            this.canvasCtx.fillRect(x, this.canvasHeight - barHeight / 2, this.analyserBarWidth, barHeight);
            x += this.analyserBarWidth;
        }

        requestAnimationFrame(() => this.draw());
    }

    makeFilter(type, frequency, gain) {
        const filter = this.audioContext.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.gain.value = gain;
        return filter;
    }

    makeChord(...frequencies) {
        return [...frequencies].map(frequency => this.makeKarplusStrongNode(frequency));
    }

    makeKarplusStrongNode(frequencyInHz, maxAmplitude = 1) {
        const pluckPeriodInMillis = 1000;
        const impulseDurationInSeconds = 0.0005;
        const impulseDurationInSamples = Math.round(impulseDurationInSeconds * this.audioContext.sampleRate);
        let impulseCountdownInSamples = impulseDurationInSamples;
        const karplusStrongNode = this.audioContext.createScriptProcessor(4096, 0, 1);
        const delaySizeInSamples = Math.round(this.audioContext.sampleRate / frequencyInHz);
        const delayBuffer = new Float32Array(delaySizeInSamples);
        let delayBufferIndex = 0;
        const gain = 0.995;
        let nextPluckTime = Date.now() + pluckPeriodInMillis;
        karplusStrongNode.addEventListener("audioprocess", (event) => {
            const now = Date.now();
            if (now >= nextPluckTime) {
                nextPluckTime = now + pluckPeriodInMillis;
                impulseCountdownInSamples = impulseDurationInSamples;
            }

            const output = event.outputBuffer.getChannelData(0);
            for (let i = 0; i < event.outputBuffer.length; i++) {
                const noiseSample = (--impulseCountdownInSamples >= 0) ? Karplus.random(maxAmplitude) : 0;
                delayBuffer[delayBufferIndex] = noiseSample + gain *
                    (delayBuffer[delayBufferIndex] + delayBuffer[(delayBufferIndex + 1) % delaySizeInSamples]) / 2;
                output[i] = delayBuffer[delayBufferIndex];
                if (++delayBufferIndex >= delaySizeInSamples) {
                    delayBufferIndex = 0;
                }
            }
        });

        return karplusStrongNode;
    }

    static random(range) {
        return Math.random() * 2 * range - range;
    }

    makeDistortionNode() {
        // distortion as seen here: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createWaveShaper
        const distortion = this.audioContext.createWaveShaper();

        const distortionAmount = 400;
        const nSamples = 44100;
        const curve = new Float32Array(nSamples);
        const deg = Math.PI / 180;
        for (let i = 0; i < nSamples; i++) {
            let x = i * 2 / nSamples - 1;
            curve[i] = (3 + distortionAmount) * x * 20 * deg / (Math.PI + distortionAmount * Math.abs(x));
        }

        distortion.curve = curve;
        distortion.oversample = "4x";
        return distortion;
    }

    makeDistortionNode2() {
        const curve = new Float32Array(139);
        const distortion = this.audioContext.createWaveShaper();
        for (let i = 0; i < curve.length; ++i) {
            let x = 2 * i / (curve.length-1) - 1;
            x *= 0.686306;
            const a = 1 + Math.exp(Math.sqrt(Math.abs(x)) * -0.75);
            curve[i] = (Math.exp(x) - Math.exp(-x * a)) / (Math.exp(x) + Math.exp(-x));
        }
        distortion.curve = curve;
        return distortion;
    }

    updateVolume() {
        const value = this.volumeElement.value;
        const normalizedVolume = value / this.volumeElement.max;
        this.gainNode.gain.setValueAtTime(normalizedVolume, this.audioContext.currentTime);
    }
}

window.addEventListener("load", () => new Karplus());
