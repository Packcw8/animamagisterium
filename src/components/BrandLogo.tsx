import { Image, ImageStyle, StyleProp, StyleSheet } from "react-native";

const logo = require("../../assets/logo.jpeg");

type BrandLogoProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function BrandLogo({ size = 72, style }: BrandLogoProps) {
  return <Image source={logo} resizeMode="contain" style={[styles.logo, { width: size, height: size }, style]} />;
}

const styles = StyleSheet.create({
  logo: {
    borderRadius: 10,
  },
});
