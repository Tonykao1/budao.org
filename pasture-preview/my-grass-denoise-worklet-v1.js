/* Private voice denoise, Stage 1: gentle downward expander (not RNNoise).
 * Processes only the live monitoring stream; never creates or persists audio.
 */
class MyGrassDenoiseProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.strength=35;
    this.envelope=0;
    this.gain=1;
    this.port.onmessage=event=>{
      const value=Number(event.data?.strength);
      if(event.data?.type==='strength'&&Number.isFinite(value))
        this.strength=Math.max(0,Math.min(100,value));
    };
  }
  process(inputs,outputs){
    const input=inputs[0],output=outputs[0];
    if(!output||!output.length)return true;
    const channels=Math.min(input?.length||0,output.length);
    if(!channels){for(const out of output)out.fill(0);return true}
    const strength=this.strength/100;
    const threshold=Math.pow(10,(-51+strength*17)/20);
    const minimum=Math.pow(10,(-8-strength*24)/20);
    const rise=Math.exp(-1/(sampleRate*.009));
    const fall=Math.exp(-1/(sampleRate*.16));
    const smooth=Math.exp(-1/(sampleRate*.019));
    for(let i=0;i<output[0].length;i++){
      let energy=0;
      for(let ch=0;ch<channels;ch++){
        const sample=input[ch][i]||0;
        energy+=sample*sample;
      }
      const amplitude=Math.sqrt(energy/channels);
      const follower=amplitude>this.envelope?rise:fall;
      this.envelope=follower*this.envelope+(1-follower)*amplitude;
      const transition=Math.max(0,Math.min(1,(this.envelope-threshold*.45)/(threshold*1.4)));
      const eased=transition*transition*(3-2*transition);
      const wanted=minimum+(1-minimum)*eased;
      this.gain=smooth*this.gain+(1-smooth)*wanted;
      for(let ch=0;ch<channels;ch++)output[ch][i]=(input[ch][i]||0)*this.gain;
      for(let ch=channels;ch<output.length;ch++)output[ch][i]=0;
    }
    return true;
  }
}
registerProcessor('my-grass-denoise-v1',MyGrassDenoiseProcessor);
