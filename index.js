
class Karplus {

    constructor () {
        this.audioContext = new window.AudioContext();

        // white noise generator
        this.whiteNoiseBufferSize = 1 << 14;  // 16kB
        this.whiteNoise = this.audioContext.createScriptProcessor(this.whiteNoiseBufferSize, 1, 1);
        this.whiteNoise.addEventListener("audioprocess", (event) => {
            const output = event.outputBuffer.getChannelData(0);
            for (let i = 0; i < this.whiteNoiseBufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
        });

        // gain node
        this.gainNode = this.audioContext.createGain();

        // volume element
        this.volumeElement = document.getElementById("volume");
        this.volumeElement.addEventListener("input", (event) => {
            const value = event.target.value;
            const normalizedVolume = value / event.target.max;
            this.gainNode.gain.setValueAtTime(normalizedVolume, this.audioContext.currentTime);
        });

        // connect nodes
        this.whiteNoise.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
    }
}

window.addEventListener("load", () => new Karplus());
