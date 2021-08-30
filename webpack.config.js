
var webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

 
module.exports = {
    mode,
    // 页面入口文件配置
    entry : {
        'main': './client/app.jsx'
    },
    // 入口文件输出配置
    output : {
        path : __dirname + '/public/javascripts/',
        filename : '[name].bundle.js'
    },
    module: {
        rules: [ 
          {
            test: /\.jsx?$/,
            exclude: /node_modules/,
            use: [{loader: 'babel-loader', options:{
                 presets: ['es2015', 'react'],
                 plugins: [
                    ['import', { libraryName: 'antd', style: 'css' }],
                ]
                }}]
          },    
        //   {
        //     test: /\.css$/i,
        //     exclude: /\.modules?\.css$/i,
        //     use: [MiniCssExtractPlugin.loader, 'css-loader']
        //   },
        //   {
        //     test: /\.modules?\.css$/i,
        //     use: [
        //       MiniCssExtractPlugin.loader,
        //       {
        //         loader: 'css-loader',
        //         options: {
        //           modules: {
        //             localIdentName: '[name]__[local]___[hash:base64:5]',
        //             exportLocalsConvention: 'camelCaseOnly'
        //           },
        //           importLoaders: 1,
        //           esModule: true
        //         }
        //       }
        //     ]
        //   },
          {
            test: /\.css$/,
            use: ['style-loader','css-loader']
          },
          {
            test: /\.less$/,
             use: ExtractTextPlugin.extract({
                 use: [{
                        loader : 'css-loader?importLoaders=1',
                       },
                       {
                        loader : 'postcss-loader',
                        options: {
                           plugins: function() {
                                    return [
                                      require('autoprefixer')
                                      ({
                                       browsers: ['ios >= 7.0']
                                     })];
                              }
                         }
                        },
                       //加载less-loader同时也得安装less;
                      "less-loader"
                     ]
                })
           },
          {
            test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/i,
            loader: 'url-loader',
            options: {
              limit: 200000,
              mimetype: 'application/font-woff'
            }
          },
          {
            test: /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i,
            loader: 'url-loader',
            options: {
              limit: 124000,
              name: `[name]-[${false ? 'contenthash' : 'hash'}].[ext]`
            }
          }
        ]
      },
    // 其他解决方案配置
    resolve: {
        extensions: ['', '.js', '.jsx', '.css', '.json'],
    },
    // 插件项
    optimization: { //与entry同级
        minimizer: [
          new UglifyJsPlugin({
            uglifyOptions: {
              compress: false,
              mangle: true,
              output: {
                comments: false,
              },
            },
            sourceMap: false,
          })
        ]   
    }
}