String.prototype.startsWith = function (str){
  return this.slice(0, str.length) == str
}

String.prototype.endsWith = function (str){
  return this.slice(-str.length) == str
}

jQuery.when.all = function(deferreds) {
  var dfd = new jQuery.Deferred()
  $.when.apply(jQuery, deferreds).then(
    function(){
      dfd.resolve(Array.prototype.slice.call(arguments))
    },
    function(){
      dfd.fail(Array.prototype.slice.call(arguments))
    })
  return dfd
}

function sqlEscape(str, literal) {
  if(literal){
    quote = "'" // set literal to true for strings you're inserting into a table
    singleQuote = "''"
    doubleQuote = '"'
  } else {
    quote = '"' // set literal to false for column and table names
    singleQuote = "'"
    doubleQuote = '""'
  }
  if(str === '' || str === null){
    return 'NULL'
  } else if(isNaN(str)){
    str = str.replace(/[']/g, singleQuote)
    str = str.replace(/["]/g, doubleQuote)
    return quote + str + quote
  } else {
    return str
  }
}

var filterUnderscores = function(names){
  return _.filter(names, function(name){
    if(name.startsWith('_')){ 
      return false
    } else {
      return true
    }
  })
}

var findTypes = function(meta){
  var dfd = $.Deferred()
  var queries = []
  $.each(meta['table'], function(tableName, tableMeta){
    meta['table'][tableName]['columnTypes'] = []
    $.each(meta['table'][tableName]['columnNames'], function(columnIndex, columnName){
      console.log('table =', tableName, 'columnIndex =', columnIndex, 'columnName =', columnName)
      queries.push(
        scraperwiki.sql('SELECT '+ sqlEscape(columnIndex, true) +' AS "columnIndex", '+ sqlEscape(tableName, true) +' AS "table", TYPEOF('+ sqlEscape(columnName) +') AS "type", COUNT(rowid) AS "n" FROM '+ sqlEscape(tableName) +' WHERE '+ sqlEscape(columnName) +' IS NOT NULL GROUP BY TYPEOF('+ sqlEscape(columnName) +')')
      )
    })
  })
  $.when.all(queries).done(function(results){
    $.each(results, function(i, result){
      var tableName = result[0][0]['table']
      var columnIndex = result[0][0]['columnIndex']
      if(result[0].length == 1){
        meta['table'][tableName]['columnTypes'][columnIndex] = result[0][0]['type']
      } else {
        meta['table'][tableName]['columnTypes'][columnIndex] = 'mixed'
      }
    })
    dfd.resolve(meta)
  })
  return dfd.promise()
}

var loadTables = function(){
  scraperwiki.sql.meta(function(meta){
    findTypes(meta).done(function(meta){
      datasetMeta = meta
      tables = filterUnderscores(_.keys(meta.table))
      if(tables.length){
        $.each(tables, function(i, tableName){
          $('<option>').text(tableName).val(tableName).appendTo('#sourceTables select')
        })
        selectTable()
        $('#chartTypes a').eq(0).trigger('click')
      } else {
        scraperwiki.alert('This dataset is empty', 'Try running this tool again once you&rsquo;ve got some data.')
      }
    })
  }, function(){
    scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql.meta() failed', 1)
  })
}

var selectTable = function(){
  var selectedTable = $('#sourceTables select').val()
  $.each(datasetMeta['table'][selectedTable]['columnNames'], function(columnIndex, columnName){
    $('<option>').text(columnName).val(columnName).appendTo('select.hAxis')
    var columnType = datasetMeta['table'][selectedTable]['columnTypes'][columnIndex]
    if(columnType == 'real' || columnType == 'integer'){
      $('<option>').text(columnName).val(columnName).appendTo('select.vAxis')
    }
  })
}

var refreshChart = function(){
  var selectedTable = $('#sourceTables select').val()
  var type = $('#chartTypes .active a').attr('data-type')
  if(type == 'ColumnChart'){
    hAxis = $('#barChartSettings .hAxis').val()
    vAxis = $('#barChartSettings .vAxis').val()
    if($('#barChartSettings .orderBy').val() != ''){
      var orderBy = ' order by "' + $('#barChartSettings .orderBy').val() + '" desc'
    } else {
      var orderBy = ''
    }
    scraperwiki.sql('select "' + hAxis + '", "' + vAxis + '" from "' + selectedTable + '"' + orderBy, function(data){
      if(data.length){
        console.log('refreshChart() data =', data)
        var googleData = googlifyData(data)
        var chart = new google.visualization[type]($('#chart')[0])
        var options = {
          hAxis: {
            title: hAxis
          }, vAxis: {
            title: vAxis
          },
          legend: {
            position: 'none'
          }
        }
        chart.draw(googleData, options)
      } else {
        scraperwiki.alert('This dataset is empty', 'Try running this tool again once you&rsquo;ve got some data.')
      }
    }, function(){
      scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql() failed', 1)
    })
  }
}

var googlifyData = function(data){
  // converts data from standard scraperwiki SQL API format
  // into the format Google Charts requires
  var dataList = []
  dataList.push(_.keys(data[0]))
  $.each(data, function(i, row){
    dataList.push(_.values(row))
  })
  console.log('googlifyData() dataList =', dataList)
  return google.visualization.arrayToDataTable(dataList)
}

var datasetMeta = null

google.load('visualization', '1.0', {'packages':['corechart']})
google.setOnLoadCallback(function(){
  console.log('Google Charts API has loaded')
})

$(function(){
  $(document).on('change', '#sourceTables', selectTable)
  $(document).on('change', 'select.columns', refreshChart)
  loadTables()
})
