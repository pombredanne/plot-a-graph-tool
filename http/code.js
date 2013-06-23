String.prototype.startsWith = function (str){
  return this.slice(0, str.length) == str
}

String.prototype.endsWith = function (str){
  return this.slice(-str.length) == str
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

var loadTables = function(){
  scraperwiki.sql.meta(function(meta){
    datasetMeta = meta
    tables = filterUnderscores(_.keys(meta.table))
    if(tables.length){
      $.each(tables, function(i, tableName){
        $('<option>').text(tableName).val(tableName).appendTo('#sourceTables select')
      })
      selectTable()
    } else {
      scraperwiki.alert('This dataset is empty', 'Try running this tool again once you&rsquo;ve got some data.')
    }
  }, function(){
    scraperwiki.alert('An unexpected error occurred', 'scraperwiki.sql.meta() failed', 1)
  })
}

var selectTable = function(){
  var selectedTable = $('#sourceTables select').val()
  $.each(datasetMeta.table[selectedTable].columnNames, function(i, columnName){
    $('<option>').text(columnName).val(columnName).appendTo('select.columns')
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
  $(document).on('click', '#chartTypes a', refreshChart)
  $(document).on('change', 'select.columns', refreshChart)
  loadTables()
})
