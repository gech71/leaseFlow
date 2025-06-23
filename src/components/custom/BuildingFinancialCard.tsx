
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Building, DollarSign, TrendingUp, AlertCircle, Clock, CheckCircle } from "lucide-react";

interface BuildingFinancialCardProps {
  buildingName: string;
  currentMonthExpenses: number;
  currentMonthIncomeCollected: number;
  currentMonthIncomePendingConfirmation: number;
  currentMonthIncomeToBeCollected: number;
  periodDescription: string;
}

export function BuildingFinancialCard({
  buildingName,
  currentMonthExpenses,
  currentMonthIncomeCollected,
  currentMonthIncomePendingConfirmation,
  currentMonthIncomeToBeCollected,
  periodDescription,
}: BuildingFinancialCardProps) {
  const netCurrentMonth = currentMonthIncomeCollected - currentMonthExpenses;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-1">
          <Building className="h-5 w-5 text-primary" />
          <CardTitle className="font-headline text-lg text-foreground">{buildingName}</CardTitle>
        </div>
        <CardDescription className="text-xs">Summary for {periodDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm flex-grow">
        <div className="flex items-center justify-between p-1.5 bg-destructive/10 rounded-md">
          <div className="flex items-center">
            <DollarSign className="h-3 w-3 text-destructive mr-1.5" />
            <span className="font-medium text-destructive text-xs">Expenses:</span>
          </div>
          <span className="font-semibold text-destructive text-xs">{currentMonthExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
        </div>

        <div className="space-y-1">
           <p className="text-xs text-muted-foreground font-semibold">Income:</p>
            <div className="flex items-center justify-between p-1 bg-green-500/10 rounded-md">
              <div className="flex items-center">
                <CheckCircle className="h-3 w-3 text-green-600 mr-1.5" />
                <span className="text-green-700 text-xs">Collected:</span>
              </div>
              <span className="font-medium text-green-700 text-xs">{currentMonthIncomeCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
            </div>
            <div className="flex items-center justify-between p-1 bg-blue-500/10 rounded-md">
              <div className="flex items-center">
                 <Clock className="h-3 w-3 text-blue-600 mr-1.5" />
                <span className="text-blue-700 text-xs">Pending:</span>
              </div>
              <span className="font-medium text-blue-700 text-xs">{currentMonthIncomePendingConfirmation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
            </div>
             <div className="flex items-center justify-between p-1 bg-yellow-500/10 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-3 w-3 text-yellow-700 mr-1.5" />
                <span className="text-yellow-800 text-xs">Due:</span>
              </div>
              <span className="font-medium text-yellow-800 text-xs">{currentMonthIncomeToBeCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
            </div>
        </div>
        
      </CardContent>
      <CardFooter className="border-t mt-auto pt-2 pb-3">
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
                <TrendingUp className={`h-4 w-4 mr-1.5 ${netCurrentMonth >= 0 ? 'text-green-500' : 'text-destructive'}`} />
                <span className="text-xs font-semibold text-muted-foreground">Net:</span>
            </div>
            <span className={`text-sm font-bold ${netCurrentMonth >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {netCurrentMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr
            </span>
        </div>
      </CardFooter>
    </Card>
  );
}
