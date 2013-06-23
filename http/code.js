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
    $('<option>').text(columnName).val(columnName).appendTo('#xAxis')
    var columnType = datasetMeta['table'][selectedTable]['columnTypes'][columnIndex]
    if(columnType == 'real' || columnType == 'integer'){
      $('<option>').text(columnName).val(columnName).appendTo('#yAxis')
    }
  })
}

var refreshChart = function(){
  var selectedTable = $('#sourceTables select').val()
  var type = $('#chartTypes .active a').attr('data-type')
  var hAxis = $('#xAxis').val()
  var vAxis = $('#yAxis').val()
  if($('#sortAscending')[0].checked){
    var orderBy = ' ORDER BY ' + sqlEscape(vAxis) + ' ASC'
  } else if($('#sortDescending')[0].checked){
    var orderBy = ' ORDER BY ' + sqlEscape(vAxis) + ' DESC' 
  } else {
    var orderBy = ''
  }
  scraperwiki.sql('SELECT '+ sqlEscape(hAxis) +', '+ sqlEscape(vAxis) +' FROM '+ sqlEscape(selectedTable) + orderBy, function(data){
    if(data.length){
      console.log('refreshChart() data =', data)
      var googleData = googlifyData(data)
      var chart = new google.visualization[type]($('#chart')[0])
      var options = {
        hAxis: { title: hAxis }, 
        vAxis: { title: vAxis },
        legend: { position: 'none' }
      }
      if(type == 'PieChart'){
        delete options.legend
        options.is3D = $('#is3d')[0].checked
        options.pieSliceText = $('#pieChartLabel').val()
      } else if(type == 'LineChart'){
        if($('#smoothCorners')[0].checked){
          options.curveType = 'function'
        }
        if($('#pointCorners')[0].checked){
          options.pointSize = 5
        }
      } else if(type == 'ScatterChart'){
        if($('#trendline')[0].checked){
          options.trendlines = { 0: {} }
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

var googlifyData = function(data){
  // converts data from standard scraperwiki SQL API format
  // into the format Google Charts requires
  var selectedTable = $('#sourceTables select').val()
  var dataList = []
  dataList.push(_.keys(data[0]))
  $.each(data, function(i, row){
    var values = []
    $.each(row, function(columnName, value){
      var columnIndex = datasetMeta['table'][selectedTable]['columnNames'].indexOf(columnName)
      var columnType = datasetMeta['table'][selectedTable]['columnTypes'][columnIndex]
      if(columnType == 'mixed' || columnType == 'text'){
        values.push('' + value)
      } else {
        values.push(value)
      }
    })
    dataList.push(values)
  })
  console.log('googlifyData() dataList =', dataList)
  return google.visualization.arrayToDataTable(dataList)
}

var switchType = function(e){
  var $li = $(this).parent()
  var type = $(this).attr('data-type')
  if(!$li.is('.active')){
    $li.addClass('active').siblings().removeClass('active')
    $('nav > section').hide()
    $(typePanels[type]).show()
  }
  refreshChart()
}

var datasetMeta = null

var typePanels = {
  ColumnChart: '#xAxisSettings, #yAxisSettings',
  LineChart: '#xAxisSettings, #yAxisSettings, #lineChartSettings',
  ScatterChart: '#xAxisSettings, #yAxisSettings, #scatterTrendline',
  PieChart: '#xAxisSettings, #yAxisSettings, #pieChartLabels, #pieChart3d'
}

google.load('visualization', '1.0', {'packages':['corechart']})
google.setOnLoadCallback(function(){
  console.log('Google Charts API has loaded')
})

$(function(){
  $(document).on('change', '.mutually-exclusive :checkbox', function(){
    if(this.checked){ $(this).siblings(':checked').attr('checked', false) }
  })
  $('#sourceTables').on('change', selectTable)
  $('section select, section :checkbox').on('change', refreshChart)
  $('#chartTypes a').on('click', switchType)
  loadTables()
})
