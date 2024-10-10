const path = require('path');
const webpack = require('webpack');

const isProduction = true;

module.exports = {
  mode: 'production',
  context: path.resolve(__dirname, 'src'),
  entry: {
    webgl: './canvas.ts',
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    library: 'WEBGL',
    libraryTarget: 'umd',
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
      }, {
        test: /\.(vert|frag|comp|wgsl)$/,
        use: 'raw-loader',
      }, {
        test: /\.css/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              url: false,
              sourceMap: false,
              importLoaders: 2
            },
          },
        ],
      }
    ],
  },
  resolve: {
    extensions: [
      '.ts', '.js',
    ],
  },
  devtool: false,
  plugins: [
    new webpack.DefinePlugin({
      PRODUCTION_BUILD: JSON.stringify(isProduction),
    })
  ],
};
