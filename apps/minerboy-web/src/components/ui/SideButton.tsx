interface SideButtonProps {
  width?: number;
  height?: number;
  onClick?: () => void;
}

export default function SideButton({ width = 9, height = 69.91, onClick }: SideButtonProps) {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 56 435" 
      version="1.1" 
      xmlns="http://www.w3.org/2000/svg" 
      xmlnsXlink="http://www.w3.org/1999/xlink" 
      xmlSpace="preserve"
      style={{ 
        fillRule: "evenodd", 
        clipRule: "evenodd", 
        strokeLinejoin: "round", 
        strokeMiterlimit: 2,
        cursor: onClick ? "pointer" : "default"
      }}
      onClick={onClick}
    >
      <g transform="matrix(1,0,0,0.920052,1.32469e-16,-377.504)">
        <path 
          d="M-0,852.192L-0,441.021C0.061,421.81 30.113,405.189 40.261,411.775C49.878,418.016 55.769,429.221 55.769,441.318L55.755,646.607L55.769,851.896C55.769,863.992 49.878,875.197 40.261,881.439C30.113,888.024 0.061,871.403 -0,852.192Z" 
          style={{ fill: "url(#_Linear1)" }}
        />
      </g>
      <g transform="matrix(0.757,0,0,0.862838,9.25047,-340.509)">
        <path 
          d="M-0,852.192L-0,441.021C0.061,421.81 30.113,405.189 40.261,411.775C49.878,418.016 55.769,429.221 55.769,441.318L55.755,646.607L55.769,851.896C55.769,863.992 49.878,875.197 40.261,881.439C30.113,888.024 0.061,871.403 -0,852.192Z" 
          style={{ fill: "url(#_Linear2)" }}
        />
      </g>
      <defs>
        <linearGradient 
          id="_Linear1" 
          x1="0" 
          y1="0" 
          x2="1" 
          y2="0" 
          gradientUnits="userSpaceOnUse" 
          gradientTransform="matrix(32.0134,457.903,-421.295,34.7952,9.25047,425.002)"
        >
          <stop offset="0" style={{ stopColor: "rgb(90,108,182)", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "rgb(40,56,102)", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient 
          id="_Linear2" 
          x1="0" 
          y1="0" 
          x2="1" 
          y2="0" 
          gradientUnits="userSpaceOnUse" 
          gradientTransform="matrix(27.9614,462.221,-526.845,24.5316,10.5596,420.685)"
        >
          <stop offset="0" style={{ stopColor: "rgb(109,126,192)", stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: "rgb(51,63,121)", stopOpacity: 1 }} />
        </linearGradient>
      </defs>
    </svg>
  );
}
