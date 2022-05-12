#version 300 es

precision highp float;
precision highp isampler2D;

uniform Settings {
  float u_opacity;
};

uniform sampler2D u_tilesTexture;
uniform isampler2D u_tilePositionsTexture;
uniform isampler2D u_imagePositionsTexture;
uniform isampler2D u_scaleFactorsTexture;

in vec4 v_vertex_color;
out vec4 outColor;

void main() {
  vec4 color = texelFetch(u_tilesTexture, ivec2(50, 50), 0);
  ivec2 tilesTextureSize = textureSize(u_tilesTexture, 0);

  // textureSize = afmetingen van tileTexture!
  // textureSize: regl.prop('textureSize'),

  // tilesount = textureSize(u_image0, 0); hoogte van deze texture
  // u_tileCount: regl.prop('tileCount'),

  // ivec4 intColor = texture(u_image0, vec2(0.0, 0.0));
  // float value = float(intColor.r);
  // ivec2 s = textureSize(u_image0, 0);


  ivec4 scaleFactorTexel = texelFetch(u_scaleFactorsTexture, ivec2(0, 0), 0);
  int scaleFactor = scaleFactorTexel.r;

  // float value = float(scaleFactor) / 64.0;
  float value = float(tilesTextureSize.y) / 164.0;
  // float value = color.r;
  // float value = 0.5;

  outColor = vec4(value, color.g, color.b, u_opacity);
  // outColor = v_vertex_color;
}