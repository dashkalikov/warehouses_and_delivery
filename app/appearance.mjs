export const themeNames={light:['Светлая','sun'],dark:['Тёмная','moon'],system:['Как в системе','screen']};

export const palettes={
  kontur:{
    label:'Фирменная',
    light:{canvas:'#f4f5f7',sidebar:'#242931',accent:'#476584',action:'#f6cb45',ink:'#25220f'},
    dark:{canvas:'#1b2028',sidebar:'#181d24',accent:'#a4c5e8',action:'#f7ce58',ink:'#25220f'},
  },
  ocean:{
    label:'Лазурь',
    light:{canvas:'#edf4fa',sidebar:'#142b41',accent:'#225c92',action:'#126bad',ink:'#ffffff'},
    dark:{canvas:'#111d2c',sidebar:'#102133',accent:'#9bd3ff',action:'#7ec7f5',ink:'#102235'},
  },
  pine:{
    label:'Хвоя',
    light:{canvas:'#edf5f1',sidebar:'#142f27',accent:'#24674e',action:'#187557',ink:'#ffffff'},
    dark:{canvas:'#172721',sidebar:'#11251d',accent:'#a3dfc1',action:'#83d4ad',ink:'#122a22'},
  },
  iris:{
    label:'Лаванда',
    light:{canvas:'#f3effa',sidebar:'#262040',accent:'#624597',action:'#6546b3',ink:'#ffffff'},
    dark:{canvas:'#211a31',sidebar:'#211935',accent:'#d8caff',action:'#c5aff8',ink:'#261b42'},
  },
  clay:{
    label:'Терракота',
    light:{canvas:'#faf2ec',sidebar:'#392724',accent:'#8d4536',action:'#9f4c32',ink:'#ffffff'},
    dark:{canvas:'#30221e',sidebar:'#291e1b',accent:'#ffc7b2',action:'#f3b296',ink:'#36211a'},
  },
  berry:{
    label:'Малина',
    light:{canvas:'#f8eff5',sidebar:'#362237',accent:'#8e3d63',action:'#a2386a',ink:'#ffffff'},
    dark:{canvas:'#2b1d29',sidebar:'#2b1b2a',accent:'#f2b7db',action:'#eda4cb',ink:'#321c2b'},
  },
};

export function resolveAppearance(theme,selected,systemDark) {
  const mode=theme==='dark'||(theme==='system'&&systemDark)?'dark':'light';
  const palette=Object.hasOwn(palettes,selected)?selected:'kontur';
  return {mode,palette,colors:palettes[palette][mode]};
}
